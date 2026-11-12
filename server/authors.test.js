import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import Database from 'better-sqlite3';import express from 'express';
import {authorSchema,AUTHOR_FORMAT,AUTHOR_VERSION,normalizeIdentity,inspectAuthorPackage,matchAuthorIdentity} from './author-package.js';
import {createAuthorStore,registerAuthorTransfer} from './author-store.js';import {createAuthorService,registerAuthors} from './authors.js';

function makePackage(folder,name='source.db') {
  const filename=path.join(folder,name),db=new Database(filename);authorSchema(db);
  db.prepare('INSERT INTO manifest VALUES(?,?,?,?,?,?,?)').run(AUTHOR_FORMAT,AUTHOR_VERSION,'2026-11-13T00:00:00.000Z','Special.mdb/Auth + metadata pustaka','a'.repeat(64),2,3);
  const a=db.prepare('INSERT INTO authors VALUES(?,?,?,?,?,?)');a.run(7,'السيوطي','ترجمة المؤلف','911','Special.mdb/Auth/7',normalizeIdentity('السيوطي'));a.run(8,'ابن حجر','','852','Special.mdb/Auth/8',normalizeIdentity('ابن حجر'));
  const w=db.prepare('INSERT INTO works VALUES(?,?,?,?,?)');for(const [id,title] of [[100,'الإتقان'],[101,'عنوان من المصدر'],[102,'كتاب ينتظر المراجعة']])w.run(id,title,'السيوطي','Source catalogue',normalizeIdentity(title));
  db.prepare('INSERT INTO attributions VALUES(?,?,?,?)').run(100,7,'metadata-exact','Exact source author name and metadata relation');db.prepare('INSERT INTO attributions VALUES(?,?,?,?)').run(101,7,'source-explicit','Source book ID and title match');db.close();return filename;
}
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'authors-test-')),input=makePackage(dir),store=createAuthorStore(path.join(dir,'store'));const clean=path.join(dir,'clean.db');inspectAuthorPackage(input,clean);store.install(clean);
 const library=[{bkid:100,bk:'الإتقان'},{bkid:101,bk:'عنوان مختلف تماما'},{bkid:102,bk:'كتاب ينتظر المراجعة'},{bkid:103,bk:'كتاب جديد'}];const service=createAuthorService(store,()=>library);
 t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return{dir,input,store,service,library};}
test('identity matching never trusts numeric IDs, fuzzy fragments, duplicates or conflicting death years',()=>{
  const candidates=[{id:999,name:'السيوطي',death_text:'911'}];
  assert.equal(matchAuthorIdentity({id:7,name:'السيوطي',death_text:'911'},candidates).id,999);
  assert.equal(matchAuthorIdentity({id:999,name:'مؤلف آخر'},candidates),null);
  assert.equal(matchAuthorIdentity({name:'السيوطي',death_text:'900'},candidates),null);
  assert.equal(matchAuthorIdentity({name:'السيوطي'},[...candidates,{id:2,name:'السيوطي'}]),null);
  assert.equal(matchAuthorIdentity({name:'السيوطي مؤلف'},candidates),null);
  assert.equal(matchAuthorIdentity({name:'السيوطي',ambiguousName:true},candidates),null);
});
test('public works require live title identity, expose provenance, and omit missing or conflicting books',t=>{
  const f=fixture(t);const a=f.service.detail(7,{});assert.equal(a.data.biography,'ترجمة المؤلف');assert.deepEqual(a.works.map(w=>w.book_id),[100]);assert.equal(a.works[0].basis,'metadata-exact');assert.equal(a.data.workCount,1);
  assert.equal(f.service.related(101).length,0);assert.equal(f.service.related(100,'Wrong title').length,0);
  assert.equal(f.service.authorList({q:'السُّيوطي'}).total,1);assert.equal(f.service.review({filter:'conflict'}).data[0].book_id,101);
  const info=f.service.bookCase(102);assert.equal(info.links.length,0);
  assert.throws(()=>f.service.detail(999,{}),/غير|لم|لا|not|Penulis/);
});
test('review confirmation/rejection/reset, multiple authors, stale edit conflicts and append-only evidence audit',t=>{
  const f=fixture(t);let item=f.service.bookCase(102);const body={book_id:102,author_id:7,expected_author:'السيوطي',expected_title:item.title,note:'Bukti pada halaman judul',revision:item.revision};
  item=f.service.decide({...body,action:'confirmed'});assert.equal(item.links[0].id,7);assert.equal(item.events[0].action,'confirmed');
  assert.throws(()=>f.service.decide({...body,action:'rejected'}),/admin lain/);
  item=f.service.decide({...body,author_id:8,expected_author:'ابن حجر',revision:item.revision,action:'confirmed'});assert.equal(item.links.length,2);
  item=f.service.decide({...body,revision:item.revision,action:'rejected'});assert.deepEqual(item.links.map(a=>a.id),[8]);
  item=f.service.decide({...body,author_id:8,expected_author:'ابن حجر',revision:item.revision,action:'reset'});assert.equal(item.links.length,0);assert.equal(item.events.length,4);
  const old=f.service.bookCase(100);assert.throws(()=>f.service.decide({...body,book_id:100,expected_title:'changed',revision:old.revision,action:'confirmed'}),/Judul/);
  assert.throws(()=>f.service.decide({...body,book_id:101,expected_title:'عنوان مختلف تماما',revision:'initial',action:'confirmed'}),/Identitas kitab/);
  assert.throws(()=>f.service.decide({...body,action:'confirmed',note:'x'}),/rujukan/);
  assert.throws(()=>f.service.decide({...body,expected_author:'Penulis lain',action:'confirmed'}),/Identitas penulis/);
});
test('library title edits/deletions and duplicate IDs invalidate public work lists immediately',t=>{
  const f=fixture(t);let version=1;const service=createAuthorService(f.store,()=>f.library,()=>version);
  assert.equal(service.detail(7,{}).total,1);f.library.find(b=>b.bkid===100).bk='A different book';version++;
  assert.equal(service.detail(7,{}).total,0);f.library.find(b=>b.bkid===100).bk='الإتقان';version++;
  assert.equal(service.detail(7,{}).total,1);f.library.push({bkid:100,bk:'Conflicting same ID'});version++;
  assert.equal(service.detail(7,{}).total,0);assert.throws(()=>service.decide({book_id:100,author_id:7,expected_author:'السيوطي',expected_title:'الإتقان',revision:'initial',action:'confirmed',note:'Evidence from source'}),/judul ganda/);
});
test('import preserves compatible local decisions, download/re-import preserves review evidence, restore and restart work',async t=>{
  const f=fixture(t),initial=f.store.status().active.id,info=f.service.bookCase(100);
  f.service.decide({book_id:100,author_id:7,expected_author:'السيوطي',expected_title:info.title,revision:info.revision,action:'rejected',note:'Rujukan menolak atribusi ini'});
  const clean=path.join(f.dir,'new-clean.db');inspectAuthorPackage(f.input,clean);const second=f.store.install(clean);assert.equal(second.preservedDecisions,1);assert.equal(f.service.detail(7,{}).total,0);
  const backup=path.join(f.dir,'download.db');await f.store.getDb().backup(backup);const reimport=path.join(f.dir,'reimport.db');inspectAuthorPackage(backup,reimport);const d=new Database(reimport);assert.equal(d.prepare('SELECT status FROM decisions').get().status,'rejected');assert.equal(d.prepare('SELECT count(*) n FROM events').get().n,2);d.close();
  f.store.activate(initial);assert.equal(f.service.detail(7,{}).total,0);
  const other=createAuthorStore(f.store.directory);assert.equal(other.status().active.id,initial);other.close();
});
test('reset review history survives import even when there is no remaining decision',t=>{
  const f=fixture(t);let item=f.service.bookCase(100);
  item=f.service.decide({book_id:100,author_id:7,expected_author:'السيوطي',expected_title:item.title,revision:item.revision,action:'rejected',note:'Bukti penolakan sementara'});
  item=f.service.decide({book_id:100,author_id:7,expected_author:'السيوطي',expected_title:item.title,revision:item.revision,action:'reset',note:'Kembali mengikuti bukti paket'});
  const clean=path.join(f.dir,'next.db');inspectAuthorPackage(f.input,clean);f.store.install(clean);
  const after=f.service.bookCase(100);assert.equal(after.events.length,2);assert.equal(after.decisions.length,0);assert.equal(after.links.length,1);
});
test('untrusted SQLite with views, wrong counts or orphaned attribution is rejected without changing active data',t=>{
  const f=fixture(t);
  for(const [name,sql]of [['view','CREATE VIEW secret AS SELECT * FROM authors'],['count','UPDATE manifest SET authors=3'],['orphan',"INSERT INTO attributions VALUES(100,999,'source-explicit','wrong')"]]){
    const input=makePackage(f.dir,`${name}.db`),d=new Database(input);d.pragma('foreign_keys=OFF');d.exec(sql);d.close();assert.throws(()=>inspectAuthorPackage(input,path.join(f.dir,`${name}-clean.db`)));assert.equal(f.service.detail(7,{}).total,1);
  }
});
test('HTTP admin auth, upload preview, activation and public routes work across an independent dataset',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'authors-http-')),store=createAuthorStore(path.join(dir,'store')),input=makePackage(dir),service=createAuthorService(store,()=>[{bkid:100,bk:'الإتقان'}]);
  const app=express();app.use(express.json());const auth=(req,res,next)=>req.headers.authorization==='Bearer test'?next():res.sendStatus(401);registerAuthorTransfer(app,{store,requireAdmin:auth});registerAuthors(app,{service,requireAdmin:auth});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close();store.close();fs.rmSync(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/api/authors')).status,503);assert.equal((await fetch(base+'/api/admin/authors/review')).status,401);
  const send=(route,body,type='application/json')=>fetch(base+route,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':type},body:Buffer.isBuffer(body)?body:JSON.stringify(body)});
  const preview=await send('/api/admin/authors-database/upload',fs.readFileSync(input),'application/octet-stream');assert.equal(preview.status,200);const ticket=await preview.json();assert.equal((await fetch(base+'/api/authors')).status,503);
  assert.equal((await send('/api/admin/authors-database/activate',{id:'../bad'})).status,400);assert.equal((await send('/api/admin/authors-database/activate',{id:ticket.id})).status,200);
  const profile=await(await fetch(base+'/api/authors/7')).json();assert.equal(profile.total,1);assert.equal((await fetch(base+'/api/authors/999')).status,404);
  const info=service.bookCase(100),res=await send('/api/admin/authors/decision',{book_id:100,author_id:7,expected_author:'السيوطي',expected_title:info.title,revision:info.revision,action:'rejected',note:'Checked source metadata'});assert.equal(res.status,200);assert.equal((await(await fetch(base+'/api/authors/7')).json()).total,0);
  const backup=await fetch(base+'/api/admin/authors-database/download',{headers:{Authorization:'Bearer test'}});assert.equal(backup.status,200);assert.equal(Buffer.from(await backup.arrayBuffer()).subarray(0,16).toString(),'SQLite format 3\0');
});
