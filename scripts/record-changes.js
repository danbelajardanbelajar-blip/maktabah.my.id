import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const [title,checks] = process.argv.slice(2);
if(!title || !checks) throw new Error('Usage: node scripts/record-changes.js "Judul perubahan" "Hasil pemeriksaan"');
const git = args => execFileSync('git',args,{encoding:'utf8',maxBuffer:30*1024*1024});
const root = git(['rev-parse','--show-toplevel']).trim();
process.chdir(root);
const files = git(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean)
  .filter(f => f!=='CHANGELOG.md' && !f.startsWith('docs/change-audit/'));
if(!files.length) throw new Error('Stage perubahan sebelum membuat catatan.');
const wib = date => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +07:00`;
};
const now=new Date(),recordedAt=wib(now);
const records=[];
for(const file of files) {
  const diff=git(['diff','--cached','--no-color','--no-renames','--unified=0','--',file]);
  const hunks=[...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/gm)].map(m=>({
    before:{line:Number(m[1]),count:Number(m[2]??1)},after:{line:Number(m[3]),count:Number(m[4]??1)},section:m[5].trim()||'module/file',
  }));
  let contents=null;
  // A deleted file has no staged blob; preserve its old-line hunks instead.
  if(!diff.includes('\n+++ /dev/null')) contents=execFileSync('git',['show',`:${file}`],{maxBuffer:30*1024*1024});
  const symbols=contents?[...contents.toString('utf8').matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?class\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=/g)].map(m=>m[1]||m[2]||m[3]):[];
  records.push({file,status:contents?(diff.includes('new file mode')?'added':'modified'):'deleted',
    lastFileModifiedAt:fs.existsSync(file)?wib(fs.statSync(file).mtime):null,
    stagedSha256:contents?crypto.createHash('sha256').update(contents).digest('hex'):null,
    diffSha256:crypto.createHash('sha256').update(diff).digest('hex'),symbols:[...new Set(symbols)],hunks});
}
const audit={schemaVersion:1,recordedAt,title,baseCommit:git(['rev-parse','HEAD']).trim(),checks,
  timestampMeaning:'recordedAt adalah waktu pencatatan; lastFileModifiedAt adalah mtime terakhir file. Waktu setiap edit terdahulu tidak direkonstruksi.',records};
const folder='docs/change-audit';fs.mkdirSync(folder,{recursive:true});
const filename=`${folder}/${recordedAt.slice(0,19).replace(/[ :]/g,'-')}-${crypto.randomBytes(3).toString('hex')}.json`;
fs.writeFileSync(filename,JSON.stringify(audit,null,2)+'\n');
const escape=s=>String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
const range=r=>r.count?`${r.line}–${r.line+r.count-1}`:'—';
const rows=records.flatMap(r=>r.hunks.length?r.hunks.map(h=>`| ${escape(r.lastFileModifiedAt||'waktu penghapusan tidak direkam')} | \`${r.file}\` | ${range(h.before)} | ${range(h.after)} | ${escape(h.section==='module/file'?(r.symbols.slice(0,8).join(', ')||h.section):h.section)} | ${r.status} |`):[`| ${escape(r.lastFileModifiedAt||'tidak tersedia')} | \`${r.file}\` | — | — | aset/biner | ${r.status} |`]);
const entry=`\n## [${recordedAt}] — ${escape(title)}\n\nWaktu pencatatan: **${recordedAt}**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit \`${audit.baseCommit.slice(0,7)}\`; baris sesudah mengacu pada isi staged commit ini.\n\nVerifikasi: ${escape(checks)}\n\nAudit terstruktur beserta hash isi staged dan diff: [${path.basename(filename)}](${filename}).\n\n| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
fs.appendFileSync('CHANGELOG.md',entry);
console.log(JSON.stringify({recordedAt,audit:filename,files:records.length,hunks:records.reduce((n,r)=>n+r.hunks.length,0)}));
