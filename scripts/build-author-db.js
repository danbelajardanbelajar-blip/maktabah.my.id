import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import Database from 'better-sqlite3';
import {authorSchema,normalizeIdentity,matchAuthorIdentity,AUTHOR_FORMAT,AUTHOR_VERSION,authorStats} from '../server/author-package.js';

const [sourceDir,jars,libraryPath,additionalPath,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node scripts/build-author-db.js source-folder jars main.db additional.db-or-- output.db');
if(fs.existsSync(output))throw Error('Output sudah ada; gunakan nama baru.');
const files=['Special.mdb','main.mdb'].map(n=>path.join(sourceDir,'Buka Lewat Sini','Files',n));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=files.map(sha),temp=fs.mkdtempSync(path.join(os.tmpdir(),'author-mdb-')),jsonl=path.join(temp,'source.jsonl');
let dst;const libraries=[];
try {
  const run=spawnSync('java',['-cp',`${path.resolve(jars)}/*`,fileURLToPath(new URL('./AuthorMdbExport.java',import.meta.url)),...files,jsonl],{encoding:'utf8',maxBuffer:1024*1024});
  if(run.status!==0)throw Error(run.stderr||run.error?.message||'Export MDB gagal.');
  const records=fs.readFileSync(jsonl,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const authors=records.filter(r=>r.table==='Auth').map(r=>r.row),sourceBooks=records.filter(r=>r.table==='0bok').map(r=>r.row);
  const byName=new Map();for(const a of authors){const k=normalizeIdentity(a.auth);byName.set(k,[...(byName.get(k)||[]),a]);}
  dst=new Database(output);dst.pragma('foreign_keys=ON');authorSchema(dst);
  const books=new Map(),assignments=[],ambiguous=new Set();
  for(const [label,p] of [['main',libraryPath],['tambahan',additionalPath]]) {
    if(p==='-'||!p||!fs.existsSync(p))continue;
    const db=new Database(p,{readonly:true,fileMustExist:true});libraries.push(db);
    const hasAuthors=!!db.prepare("SELECT 1 FROM sqlite_master WHERE name='authors' AND type='table'").get();
    const localAuthors=new Map(hasAuthors?db.prepare('SELECT authid,auth,HigriD FROM authors').all().map(a=>[a.authid,a]):[]);
    const localNames=new Map();for(const a of localAuthors.values()){const key=normalizeIdentity(a.auth);localNames.set(key,(localNames.get(key)||0)+1);}
    for(const b of db.prepare('SELECT bkid,bk,authno FROM books_meta').iterate()) {
      if(!Number.isSafeInteger(b.bkid)||b.bkid<1||typeof b.bk!=='string'||!b.bk.trim())continue;
      const prev=books.get(b.bkid),author=localAuthors.get(b.authno),key=normalizeIdentity(b.bk);
      if(prev&&prev.title_key!==key){ambiguous.add(b.bkid);continue;}
      if(prev)continue;
      const work={book_id:b.bkid,title:b.bk,metadata_author:author?.auth||'',source_ref:`${label}.books_meta → ${label}.authors; cocok nama Auth pada Special.mdb`,title_key:key};books.set(b.bkid,work);
      const candidates=byName.get(normalizeIdentity(author?.auth))||[];
      const matched=matchAuthorIdentity({name:author?.auth,death_text:author?.HigriD,ambiguousName:(localNames.get(normalizeIdentity(author?.auth))||0)>1},candidates.map(a=>({...a,name:a.auth,death_text:a.HigriD})));
      if(matched)assignments.push({book_id:b.bkid,author_id:matched.authid,basis:'metadata-exact',evidence:`Nama sumber: ${matched.auth}; nama metadata: ${author.auth}; sumber relasi: ${label}.books_meta.authno → ${label}.authors.authid. ID penulis lintas sumber tidak disamakan.`});
    }
  }
  const sourceById=new Map(authors.map(a=>[a.authid,a]));
  for(const b of sourceBooks) {
    const a=sourceById.get(b.authno),work=books.get(b.bkid);
    if(a&&work&&normalizeIdentity(b.bk)===work.title_key&&!ambiguous.has(b.bkid))assignments.push({book_id:b.bkid,author_id:a.authid,basis:'source-explicit',evidence:`Files/main.mdb → 0bok.authno=${b.authno}; Special.mdb → Auth.authid=${a.authid}; ID kitab dan judul cocok.`});
  }
  const proposed=new Map();for(const a of assignments){if(!proposed.has(a.book_id))proposed.set(a.book_id,new Set());proposed.get(a.book_id).add(a.author_id);}
  const disputed=new Set([...proposed].filter(([,ids])=>ids.size>1).map(([id])=>id));
  for(const id of disputed)books.get(id).source_ref+='; Konflik atribusi antar sumber: '+[...proposed.get(id)].join(', ')+'. Menunggu tinjauan admin.';
  dst.transaction(()=>{
    const putAuthor=dst.prepare('INSERT INTO authors VALUES(?,?,?,?,?,?)'),putWork=dst.prepare('INSERT INTO works VALUES(?,?,?,?,?)'),putLink=dst.prepare('INSERT INTO attributions VALUES(?,?,?,?) ON CONFLICT(book_id,author_id) DO UPDATE SET basis=excluded.basis,evidence=excluded.evidence');
    for(const a of authors)putAuthor.run(a.authid,a.auth,a.inf||'',a.HigriD||'',`Special.mdb / Auth / authid=${a.authid}`,normalizeIdentity(a.auth));
    for(const b of books.values())putWork.run(b.book_id,b.title,b.metadata_author,b.source_ref,b.title_key);
    for(const a of assignments)if(!ambiguous.has(a.book_id)&&!disputed.has(a.book_id))putLink.run(a.book_id,a.author_id,a.basis,a.evidence);
    dst.prepare('INSERT INTO manifest VALUES(?,?,?,?,?,?,?)').run(AUTHOR_FORMAT,AUTHOR_VERSION,new Date().toISOString(),'MAKTABAH_CAKZEN_2026: Special.mdb/Auth + main.mdb/0bok; relasi metadata pustaka lokal',crypto.createHash('sha256').update(hashes.join(':')).digest('hex'),authors.length,books.size);
  })();
  if(files.some((p,i)=>sha(p)!==hashes[i]))throw Error('File sumber berubah selama export.');
  if(dst.pragma('integrity_check',{simple:true})!=='ok')throw Error('Integritas paket gagal.');
  console.log(JSON.stringify({output:path.resolve(output),...authorStats(dst),sourceNamedBooks:sourceBooks.length,ambiguousBookIds:ambiguous.size,disputedAttributions:disputed.size,sourceUnchanged:true,bytes:fs.statSync(output).size},null,2));
  dst.close();dst=null;
}catch(e){if(dst?.open)dst.close();if(dst)fs.rmSync(output,{force:true});throw e;}
finally{libraries.forEach(db=>db.close());fs.rmSync(temp,{recursive:true,force:true});}
