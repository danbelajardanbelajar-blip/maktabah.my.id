import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';
import {createRowaSchema,writeRowaRows,canonicalizeRowaPackage,FORMAT,VERSION} from './rowa-package.js';
import {createRowaStore,registerRowaDatabase} from './rowa-database.js';
import {searchRowa} from './rowa-search.js';
import {withRowaSources} from './rowa-codes.js';

function directory(t) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rowa-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function makePackage(dir,name='input.db',who='ت س') {
  const filename=path.join(dir,name),db=new Database(filename);
  createRowaSchema(db);
  writeRowaRows(db,[{id:5739,Name:'محمد بن إسماعيل البخاري',IsoName:'محمد بن اسماعيل البخاري',WHO:who,CODE:'5727',AQUAL:'روى عنه الترمذي # وفي رواية النسائي خلاف',ROTBA:'جبل الحفظ',R_ZAHBI:'الإمام الحافظ',telmez:'أحمد بن سهل بن مالك # مسلم (في غير الصحيح)'}]);
  db.prepare('INSERT INTO rowa_manifest VALUES(?,?,?,?,?,?)').run(FORMAT,VERSION,'2026-11-12T00:00:00.000Z','Special.mdb','a'.repeat(64),1);
  db.prepare('INSERT INTO men_detail VALUES(5739,5739,0,5739,NULL)').run();db.close();return filename;
}
test('canonical package preserves source text and references while rebuilding search',t=>{
  const dir=directory(t),input=makePackage(dir),output=path.join(dir,'canonical.db');
  const src=new Database(input);src.exec("DELETE FROM rowa_fts;INSERT INTO rowa_fts(rowid,Name,IsoName) VALUES(999,'wrong','wrong')");src.close();
  const before=fs.readFileSync(input);
  const preview=canonicalizeRowaPackage(input,output);
  assert.equal(preview.narrators,1);assert.equal(preview.biographies,1);
  const db=new Database(output,{readonly:true});
  try {
    const r=withRowaSources(db.prepare('SELECT * FROM rowa WHERE id=5739').get());
    assert.equal(r.CODE,'5727');assert.equal(r.AQUAL,'روى عنه الترمذي # وفي رواية النسائي خلاف');
    assert.deepEqual(r.books.map(b=>b.code),['ت','س']);assert.doesNotMatch(r.kutub,/موطأ/);
    assert.equal(db.prepare('SELECT Bk FROM men_detail WHERE ManId=5739').get().Bk,0);
    const result=searchRowa(db,{q:'محمد'},{buildFtsMatch:q=>({exactPhrase:`"${q}"`}),buildLikeMatch:q=>q});
    assert.equal(result.total,1);assert.equal(result.data[0].id,5739);
    assert.equal(result.data[0].AQUAL,undefined);assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
    assert.deepEqual(before,fs.readFileSync(input));
    const bytes=fs.readFileSync(input);canonicalizeRowaPackage(input,path.join(dir,'second.db'));assert.deepEqual(bytes,fs.readFileSync(input));
  } finally {db.close();}
});
test('invalid format, counts, values, views and triggers cannot become an imported database',t=>{
  const dir=directory(t);
  for(const [name,sql] of [
    ['format',"UPDATE rowa_manifest SET format='other'"],['count','UPDATE rowa_manifest SET row_count=2'],
    ['value',"UPDATE rowa SET WHO=x'00'"],['view','CREATE VIEW other AS SELECT * FROM rowa'],
    ['trigger',"CREATE TRIGGER bad AFTER INSERT ON rowa BEGIN DELETE FROM rowa; END"],
  ]) {
    const input=makePackage(dir,`${name}.db`),db=new Database(input);db.exec(sql);db.close();
    const output=path.join(dir,`${name}-out.db`);
    assert.throws(()=>canonicalizeRowaPackage(input,output));assert.equal(fs.existsSync(output),false);
  }
});
test('HTTP preview, authentication, activation, download, rollback and restart work without touching fallback data',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rowa-http-')),input=makePackage(dir),folder=path.join(dir,'installed'),fallback=new Database(':memory:');
  fallback.exec('CREATE TABLE books_meta(id INTEGER);INSERT INTO books_meta VALUES(42)');
  let store=createRowaStore(folder,()=>fallback);
  const app=express();app.use(express.json());
  const auth=(req,res,next)=>req.headers.authorization==='Bearer test'?next():res.sendStatus(401);
  registerRowaDatabase(app,{store,requireAdmin:auth});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let observer;
  t.after(()=>{server.closeAllConnections();server.close();store.close();observer?.close();fallback.close();fs.rmSync(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}/api/admin/rowa-database`;
  const send=(route='',method='GET',body)=>fetch(base+route,{method,headers:{Authorization:'Bearer test',...(Buffer.isBuffer(body)?{'Content-Type':'application/octet-stream'}:body?{'Content-Type':'application/json'}:{})},body:Buffer.isBuffer(body)?body:body?JSON.stringify(body):undefined});
  assert.equal((await fetch(base)).status,401);assert.equal(store.getDb(),fallback);
  assert.equal((await send('/upload','POST',Buffer.from('not a database file'))).status,400);
  assert.equal((await send('/upload','POST',{invalid:true})).status,415);
  const upload=await send('/upload','POST',fs.readFileSync(input));assert.equal(upload.status,200);
  const ticket=await upload.json();assert.equal(ticket.preview.narrators,1);assert.equal(store.getDb(),fallback);
  assert.equal((await send('/activate','POST',{id:'../escape'})).status,400);
  const imported=await send('/activate','POST',{id:ticket.id});assert.equal(imported.status,200);
  const first=(await imported.json()).active.id;assert.equal(store.getDb().prepare('SELECT WHO FROM rowa').get().WHO,'ت س');
  assert.equal(fallback.prepare('SELECT id FROM books_meta').get().id,42);
  assert.equal((await send('/activate','POST',{id:ticket.id})).status,404);
  const downloaded=Buffer.from(await (await send('/download')).arrayBuffer());assert.equal(downloaded.subarray(0,16).toString(),'SQLite format 3\0');
  const second=makePackage(dir,'second.db','بخ');
  observer=createRowaStore(folder);
  const preview=await (await send('/upload','POST',fs.readFileSync(second))).json();
  const updated=await (await send('/activate','POST',{id:preview.id})).json();assert.equal(updated.backups.length,1);
  assert.equal(observer.getDb().prepare('SELECT WHO FROM rowa').get().WHO,'بخ');
  assert.equal((await send('/upload','POST',Buffer.from('another broken package'))).status,400);
  assert.equal(store.getDb().prepare('SELECT WHO FROM rowa').get().WHO,'بخ');
  assert.equal((await send('/restore','POST',{id:first})).status,200);
  assert.equal(store.getDb().prepare('SELECT WHO FROM rowa').get().WHO,'ت س');
  store.close();store=createRowaStore(folder);assert.equal(store.status().active.id,first);
  assert.equal(store.getDb().prepare('SELECT count(*) n FROM rowa').get().n,1);
});
