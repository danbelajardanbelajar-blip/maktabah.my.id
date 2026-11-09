import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import Database from 'better-sqlite3';
import express from 'express';
import {MAGIC,MAX_RAW,MAX_COMPRESSED,exportCompact,decodePart,encodePart,ensureCompactSchema,startCompact,applyCompact,compactStatus,cancelCompact,activeCompact} from './compact-transfer-core.js';
import {registerCompactTransfer} from './compact-transfer.js';
import {openCompact} from '../src/lib/compact-transfer.ts';

const seed=new URL('../dev-data/seed/maktabah.db',import.meta.url);
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'maktabah-compact-')),source=path.join(directory,'source.db'),destination=path.join(directory,'destination.db'),output=path.join(directory,'package.mkt');
 fs.copyFileSync(seed,source);fs.copyFileSync(seed,destination);
 const db=new Database(destination);db.exec('DELETE FROM titles;DELETE FROM pages;DELETE FROM books_meta;DELETE FROM categories;DELETE FROM authors;');ensureCompactSchema(db);
 t.after(()=>{if(db.open)db.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {directory,source,destination,output,db};
}
function frames(filename){
 const bytes=fs.readFileSync(filename);assert.ok(bytes.subarray(0,MAGIC.length).equals(MAGIC));
 let at=MAGIC.length;const result=[];
 while(at<bytes.length){const size=bytes.readUInt32BE(at),hash=bytes.subarray(at+4,at+36).toString('hex'),compressed=bytes.subarray(at+36,at+36+size);result.push({compressed,hash,data:decodePart(compressed,hash)});at+=36+size;}
 assert.equal(at,bytes.length);return result;
}
function apply(db,parts){let s=startCompact(db,parts[0].data,parts[0].hash,parts.length);for(const p of parts.slice(1))s=applyCompact(db,p.data,p.hash);return s;}

test('compressed category round trip, read-only source, collisions, page labels, empty categories, and browser frame scan',async t=>{
 const f=fixture(t),src=new Database(f.source);
 const cat=src.prepare('SELECT cat FROM books_meta WHERE bkid=1').get().cat;
 src.prepare('INSERT INTO categories(id,name) VALUES(999999,?)').run('Empty category');
 src.prepare("UPDATE pages SET part='مقدمة',page='الغلاف' WHERE book_id=1").run();
 const expected=src.prepare('SELECT * FROM pages WHERE book_id=1 ORDER BY rowid').all();
 const books=src.prepare('SELECT count(*) n FROM books_meta WHERE cat=?').get(cat).n;src.close();
 const before=fs.statSync(f.source),hash=crypto.createHash('sha256').update(fs.readFileSync(f.source)).digest('hex');
 f.db.prepare('INSERT INTO categories(id,name) VALUES(?,?)').run(cat,'Existing different category');
 exportCompact({dbPath:f.source,selection:{categoryIds:[cat,999999]},outputPath:f.output,targetBytes:1200});
 const parts=frames(f.output);assert.ok(parts.length>3);
 assert.ok(parts.every(p=>p.compressed.length<MAX_COMPRESSED));
 const s=apply(f.db,parts);assert.equal(s.status,'done');assert.equal(s.stats.imported,books);
 assert.deepEqual(f.db.prepare('SELECT * FROM pages WHERE book_id=1 ORDER BY rowid').all(),expected);
 assert.ok(f.db.prepare("SELECT 1 FROM categories WHERE name='Empty category'").get());
 assert.equal(f.db.prepare('SELECT name FROM categories WHERE id=?').get(cat).name,'Existing different category');
 assert.equal(fs.statSync(f.source).mtimeMs,before.mtimeMs);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.source)).digest('hex'),hash);
 assert.ok(!fs.existsSync(path.join(f.directory,'book-import-backups')));
 const archive=await openCompact(new File([fs.readFileSync(f.output)],'package.mkt'));
 assert.equal(archive.id,s.id);assert.equal(archive.frames.length,parts.length);assert.equal(archive.manifest.books,books);
 assert.throws(()=>decodePart(Buffer.from('corrupt'),parts[0].hash),/Checksum/);
 await assert.rejects(openCompact(new File([fs.readFileSync(f.output).subarray(0,-1)],'cut.mkt')),/terpotong/);
});

test('resume after closing database and repeated delivery is exactly once; incomplete books stay unpublished',t=>{
 const f=fixture(t);exportCompact({dbPath:f.source,selection:{bookIds:[1]},outputPath:f.output,targetBytes:1000});const parts=frames(f.output);
 let s=startCompact(f.db,parts[0].data,parts[0].hash,parts.length);
 s=applyCompact(f.db,parts[1].data,parts[1].hash);
 assert.ok(s.pendingBook);assert.equal(f.db.prepare('SELECT count(*) n FROM books_meta').get().n,0);
 f.db.close();const db=new Database(f.destination);
 try{
  assert.deepEqual(applyCompact(db,parts[1].data,parts[1].hash),compactStatus(db,s.id));
  for(const p of parts.slice(2))s=applyCompact(db,p.data,p.hash);
  assert.equal(s.stats.imported,1);assert.equal(s.status,'done');assert.equal(activeCompact(db),null);
  const actual=db.prepare('SELECT count(*) n FROM pages WHERE book_id=1').get().n;
  assert.equal(applyCompact(db,parts.at(-1).data,parts.at(-1).hash).stats.pages,actual);
  const changed=encodePart(s.id,1,[]);assert.throws(()=>applyCompact(db,decodePart(changed.compressed,changed.hash),changed.hash),/berbeda/);
 }finally{db.close();}
});

test('bad later record rolls back the entire part and receipt; wrong order and unknown payload are rejected',t=>{
 const f=fixture(t);exportCompact({dbPath:f.source,selection:{bookIds:[1]},outputPath:f.output,targetBytes:1000});const parts=frames(f.output),manifest=parts[0];
 startCompact(f.db,manifest.data,manifest.hash,3);const book=parts.flatMap(p=>p.data.records).find(r=>r.type==='book'),page=parts.flatMap(p=>p.data.records).find(r=>r.type==='page');
 const bad=encodePart(manifest.data.id,1,[book,page,{...page,row:{...page.row,id:98765,book_id:999999}}]);
 assert.throws(()=>applyCompact(f.db,decodePart(bad.compressed,bad.hash),bad.hash),/ID halaman/);
 assert.equal(f.db.prepare('SELECT count(*) n FROM pages').get().n,0);assert.equal(compactStatus(f.db,manifest.data.id).next,1);
 assert.equal(f.db.prepare('SELECT count(*) n FROM compact_receipts').get().n,1);
 assert.throws(()=>applyCompact(f.db,{...manifest.data,sequence:2},manifest.hash),/Urutan/);
 const bomb=gzipSync(Buffer.alloc(MAX_RAW+1));assert.throws(()=>decodePart(bomb,crypto.createHash('sha256').update(bomb).digest('hex')),/dekompresi/);
});

test('existing book IDs, including additional database IDs, are not overwritten',t=>{
 const f=fixture(t),src=new Database(f.source);const existing=src.prepare('SELECT * FROM books_meta WHERE bkid=1').get();src.close();
 f.db.prepare('INSERT INTO books_meta(bkid,bk) VALUES(1,?)').run('Keep existing');
 exportCompact({dbPath:f.source,selection:{bookIds:[1]},outputPath:f.output,targetBytes:1000});
 let parts=frames(f.output),s=apply(f.db,parts);assert.equal(s.stats.skipped,1);assert.equal(s.stats.pages,0);
 assert.equal(f.db.prepare('SELECT bk FROM books_meta WHERE bkid=1').get().bk,'Keep existing');
 assert.equal(f.db.prepare('SELECT count(*) n FROM pages').get().n,0);
 assert.ok(existing);
});

test('interrupted cancellation remains locked and resumes cleanup without losing completed books',t=>{
 const f=fixture(t),src=new Database(f.source);
 src.prepare('DELETE FROM pages WHERE book_id=1').run();src.prepare('DELETE FROM titles WHERE book_id=1').run();
 const insert=src.prepare('INSERT INTO pages(id,book_id,nass) VALUES(?,1,?)');
 src.transaction(()=>{for(let i=1;i<=600;i++)insert.run(i,'صفحة طويلة للاختبار '+i+' '.repeat(100));})();src.close();
 exportCompact({dbPath:f.source,selection:{bookIds:[1]},outputPath:f.output,targetBytes:2000});const parts=frames(f.output);
 let s=startCompact(f.db,parts[0].data,parts[0].hash,parts.length);
 for(const p of parts.slice(1)){if(p.data.records.some(r=>r.type==='book_end'))break;s=applyCompact(f.db,p.data,p.hash);}
 assert.ok(s.stats.pages>500);f.db.prepare("INSERT INTO books_meta(bkid,bk) VALUES(987654,'Completed other book')").run();
 f.db.exec("CREATE TRIGGER cancel_failure BEFORE DELETE ON pages WHEN old.id=301 BEGIN SELECT RAISE(ABORT,'simulated cancellation interruption');END;");
 assert.throws(()=>cancelCompact(f.db,s.id),/interruption/);assert.equal(compactStatus(f.db,s.id).status,'cancelling');
 assert.equal(activeCompact(f.db),s.id);assert.throws(()=>applyCompact(f.db,parts[s.next].data,parts[s.next].hash),/Urutan/);
 f.db.exec('DROP TRIGGER cancel_failure');assert.equal(cancelCompact(f.db,s.id).status,'cancelled');
 assert.equal(f.db.prepare('SELECT count(*) n FROM pages WHERE book_id=1').get().n,0);
 assert.ok(f.db.prepare('SELECT 1 FROM books_meta WHERE bkid=987654').get());
 f.db.prepare("INSERT INTO pages_fts(pages_fts,rank) VALUES('integrity-check',1)").run();
});

test('oversized individual rows fail clearly and remove incomplete exports',t=>{
 const f=fixture(t),src=new Database(f.source);src.prepare('UPDATE pages SET nass=? WHERE book_id=1 AND id=(SELECT min(id) FROM pages WHERE book_id=1)').run('x'.repeat(MAX_RAW));src.close();
 assert.throws(()=>exportCompact({dbPath:f.source,selection:{bookIds:[1]},outputPath:f.output}),/8 MB/);assert.ok(!fs.existsSync(f.output));
});

test('HTTP auth, bounded chunks, no upload files or full backups, and pending book access protection',async t=>{
 const f=fixture(t),runtime={},directory=path.join(f.directory,'compact-transfer'),app=express();app.use(express.json());
 const service=registerCompactTransfer(app,{getDb:()=>f.db,getDbPath:()=>f.destination,getAdditionalPath:()=>null,localExportMode:false,runtime,directory,clearCache:()=>{},requireAdmin:(q,r,n)=>q.headers.authorization==='Bearer test'?n():r.sendStatus(401)});
 app.get('/api/book/:id',(q,r)=>r.json({visible:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));});
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/admin/compact/current')).status,401);
 exportCompact({dbPath:f.source,selection:{bookIds:[1]},outputPath:f.output,targetBytes:1000});const parts=frames(f.output);
 const post=async(url,p,auth=true)=>{const r=await fetch(base+'/api/admin/compact'+url,{method:'POST',headers:{...(auth?{Authorization:'Bearer test'}:{}),'Content-Type':'application/octet-stream','X-Part-SHA256':p.hash,'X-Total-Parts':String(parts.length)},body:p.compressed});return {status:r.status,data:await r.json()};};
 let result=await post('/start',parts[0]);assert.equal(result.status,200);const id=result.data.id;
 result=await post('/import/'+id+'/parts/1',parts[1]);assert.equal(result.status,200);
 assert.equal((await fetch(base+'/api/book/1')).status,409);
 assert.equal(fs.readdirSync(directory).length,0);assert.ok(!fs.existsSync(path.join(f.directory,'book-import-backups')));
 for(let i=2;i<parts.length;i++){result=await post('/import/'+id+'/parts/'+i,parts[i]);assert.equal(result.status,200,result.data.error);}
 assert.equal(result.data.status,'done');assert.equal(runtime.compactSession,null);
 assert.equal((await fetch(base+'/api/book/1')).status,200);
 assert.equal(fs.readdirSync(directory).length,0);
});

test('additional source export and skip detection, and a package containing only empty category zero',t=>{
 const f=fixture(t),extraPath=path.join(f.directory,'extra.db'),extra=new Database(extraPath);
 extra.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT,cat INTEGER,authno INTEGER,inf TEXT,betaka TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part TEXT,page TEXT,seal TEXT,nass TEXT);CREATE TABLE titles(id INTEGER,book_id INTEGER,lvl INTEGER,sub INTEGER,tit TEXT);INSERT INTO books_meta VALUES(999999,'Additional',456789,NULL,NULL,NULL);INSERT INTO pages VALUES(0,999999,'مقدمة','الغلاف',NULL,'نص من قاعدة إضافية');");
 extra.close();
 exportCompact({dbPath:f.source,additionalPath:extraPath,selection:{bookIds:[999999]},outputPath:f.output,targetBytes:1000});
 const parts=frames(f.output);let s=startCompact(f.db,parts[0].data,parts[0].hash,parts.length);
 for(const p of parts.slice(1))s=applyCompact(f.db,p.data,p.hash,id=>id===999999);
 assert.equal(s.stats.skipped,1);assert.equal(s.stats.imported,0);assert.equal(f.db.prepare('SELECT count(*) n FROM pages').get().n,0);
 const src=new Database(f.source);src.prepare('INSERT OR REPLACE INTO categories(id,name) VALUES(0,?)').run('Empty zero');src.prepare('DELETE FROM books_meta WHERE cat=0').run();src.close();
 const out=path.join(f.directory,'empty.mkt');exportCompact({dbPath:f.source,selection:{categoryIds:[0]},outputPath:out});
 const empty=apply(f.db,frames(out));assert.equal(empty.status,'done');assert.equal(empty.stats.imported,0);assert.ok(f.db.prepare("SELECT 1 FROM categories WHERE name='Empty zero'").get());
});

test('export ticket survives restart and interrupted export is marked failed without retaining its partial file',async t=>{
 const f=fixture(t),directory=path.join(f.directory,'tickets');fs.mkdirSync(directory);
 const id='a'.repeat(48),partial='b'.repeat(48);
 fs.writeFileSync(path.join(directory,id+'.mkt'),'ready test file');
 fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify({id,status:'ready',finishedAt:Date.now(),result:{parts:2}}));
 fs.writeFileSync(path.join(directory,partial+'.mkt'),'partial');
 fs.writeFileSync(path.join(directory,partial+'.json'),JSON.stringify({id:partial,status:'running'}));
 const app=express(),service=registerCompactTransfer(app,{getDb:()=>f.db,getDbPath:()=>f.destination,getAdditionalPath:()=>null,requireAdmin:(q,r,n)=>n(),runtime:{},localExportMode:false,directory,clearCache:()=>{}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));});
 const base='http://127.0.0.1:'+server.address().port;
 const ready=await(await fetch(base+'/api/admin/compact/exports/'+id)).json();assert.equal(ready.status,'ready');
 assert.equal(await(await fetch(base+ready.downloadUrl)).text(),'ready test file');
 assert.equal((await(await fetch(base+'/api/admin/compact/exports/'+partial)).json()).status,'failed');
 assert.ok(!fs.existsSync(path.join(directory,partial+'.mkt')));
});
