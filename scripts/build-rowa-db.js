import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import Database from 'better-sqlite3';
import {createRowaSchema,writeRowaRows,summarizeRowa,FORMAT,VERSION} from '../server/rowa-package.js';

const [mdb, jars, output] = process.argv.slice(2);
if(!mdb || !jars || !output) throw new Error('Usage: node scripts/build-rowa-db.js Special.mdb path/to/jars output.db');
if(fs.existsSync(output)) throw new Error('File output sudah ada; pilih nama baru.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'rowa-export-'));
const jsonl = path.join(temp,'source.jsonl');
let db;
try {
  const before = crypto.createHash('sha256').update(fs.readFileSync(mdb)).digest('hex');
  const run = spawnSync('java',['-cp',`${path.resolve(jars)}/*`,fileURLToPath(new URL('./RowaMdbExport.java',import.meta.url)),path.resolve(mdb),jsonl],{encoding:'utf8',maxBuffer:1024*1024});
  if(run.status !== 0) throw new Error(run.stderr || run.error?.message || 'Export MDB gagal.');
  const rows = [], men = new Map(), links = [];
  for await(const line of createInterface({input:fs.createReadStream(jsonl),crlfDelay:Infinity})) {
    const item = JSON.parse(line);
    if(item.table==='rowa') rows.push(item.row);
    else if(item.table==='men') men.set(item.row.id,item.row);
    else if(item.table==='MenDetail') links.push(item.row);
  }
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
  db = new Database(output); createRowaSchema(db);
  db.transaction(() => {
    writeRowaRows(db, rows.map(r => ({...r,Name:r.name || '',...men.get(r.id)})));
    const insert = db.prepare('INSERT INTO men_detail VALUES(?,?,?,?,?)');
    for(const r of links) insert.run(r.SpID,r.ManId,r.Bk,r.Id,r.Talween);
    db.prepare('INSERT INTO rowa_manifest VALUES(?,?,?,?,?,?)').run(FORMAT,VERSION,new Date().toISOString(),path.basename(mdb)+' / rowa, men, MenDetail; Windows-1256',before,rows.length);
  })();
  if(db.pragma('integrity_check',{simple:true})!=='ok') throw new Error('Pemeriksaan integritas gagal.');
  const after = crypto.createHash('sha256').update(fs.readFileSync(mdb)).digest('hex');
  if(before!==after) throw new Error('Sumber MDB berubah selama export.');
  console.log(JSON.stringify({output:path.resolve(output),...summarizeRowa(db),bukhari:db.prepare('SELECT id,WHO,length(AQUAL) biographyLength FROM rowa WHERE id=5739').get(),sourceUnchanged:true},null,2));
  db.close(); db=null;
} catch(error) {
  if(db?.open) db.close();
  if(db) fs.rmSync(output,{force:true});
  throw error;
} finally {fs.rmSync(temp,{recursive:true,force:true});}
