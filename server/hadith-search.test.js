import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import Database from 'better-sqlite3';import express from 'express';
import {searchHadith as searchCore,hadithMatch,buildHadithIndex,activeHadithIndex} from './hadith-search-core.js';import {registerHadithSearch} from './hadith-search.js';
const indexes=new Map();
function searchHadith({paths,query}){const key=paths.join('|');if(!indexes.has(key))indexes.set(key,buildHadithIndex({paths,directory:path.join(path.dirname(paths[0]),'index-'+paths.length)}).filename);return searchCore({paths,query,indexPath:indexes.get(key)});}
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hadith-search-')),paths=['main','extra'].map(name=>path.join(dir,name+'.db'));
  for(const [i,file] of paths.entries()){
    const db=new Database(file);db.exec("CREATE TABLE books_meta(bkid INTEGER PRIMARY KEY,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part TEXT,page TEXT,nass TEXT,PRIMARY KEY(book_id,id));CREATE VIRTUAL TABLE pages_fts USING fts5(nass,content='pages');");
    const b=db.prepare('INSERT INTO books_meta VALUES(?,?)'),p=db.prepare('INSERT INTO pages VALUES(?,?,?,?,?)');
    if(i===0){b.run(100,'صحيح البخاري');b.run(200,'سنن أبي داود');b.run(300,'سنن الدارقطني');b.run(999,'كتاب خارج المجموعة');for(let n=0;n<25;n++)p.run(n,100,'أ','ص '+n,'إنما الأعمال بالنيات كلمةمشتركة <img src=x onerror=alert(1)>');p.run(9,200,'2','20','الأعمال إنما بالنيات كلمةمشتركة');p.run(9,300,'3','30','إنما الأعمال بالنيات خارجالتسعة');p.run(9,999,'4','40','إنما الأعمال بالنيات خارجللكل');}
    else{b.run(400,'صحيح مسلم');b.run(100,'صحيح البخاري');b.run(200,'عنوان متعارض');p.run(0,400,'ب','7','إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ كلمةمشتركة');p.run(1,400,'ب','8','café');p.run(0,100,'1','1','نص مختلف لا يفتحه القارئ الأول');p.run(99,100,'1','99','صفحةتكميلية');p.run(8,200,'1','8','إنما الأعمال بالنيات');}
    db.exec("INSERT INTO pages_fts(pages_fts) VALUES('rebuild')");db.close();
  }
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return paths;
}
test('content search enforces group, source, edition and live-title identity across both databases',t=>{
  const paths=fixture(t);const first=searchHadith({paths,query:{q:'إنما الأعمال بالنيات',group:'nine'}});
  assert.equal(first.results.length,20);assert.equal(first.hasMore,true);assert(first.results.every(r=>r.bookId===100));assert(first.results[0].snippet.includes('\uE000'));assert(!first.results[0].snippet.includes('<img'));
  const second=searchHadith({paths,query:{q:'إنما الأعمال بالنيات',group:'nine',page:2}});assert.equal(second.results.length,6);assert.equal(second.hasMore,false);assert.equal(second.results.at(-1).bookId,400);assert.equal(second.results.at(-1).pageId,0);
  assert.equal(searchHadith({paths,query:{q:'cafe',book:'muslim'}}).results[0].pageId,1);
  assert.equal(searchHadith({paths,query:{q:'صفحةتكميلية',book:'bukhari'}}).results[0].pageId,99);
  assert.equal(new Set([...first.results,...second.results].map(r=>r.bookId+':'+r.pageId)).size,26);
  assert.equal(searchHadith({paths,query:{q:'خارجالتسعة',group:'nine'}}).results.length,0);
  assert.equal(searchHadith({paths,query:{q:'خارجالتسعة',group:'eleven'}}).results[0].bookId,300);
  assert.equal(searchHadith({paths,query:{q:'إنما الأعمال',group:'two',book:'muslim',edition:'400'}}).results.length,1);
  assert.throws(()=>searchHadith({paths,query:{q:'إنما',group:'two',book:'daraqutni'}}),/kelompok/);
  assert.throws(()=>searchHadith({paths,query:{q:'إنما',group:'nine',edition:'999'}}),/lingkup/);
  assert.throws(()=>searchHadith({paths,query:{q:'إنما',group:'unknown'}}),/Kelompok/);
});
test('derived index is atomic, preserves source files, detects stale hits and can rebuild after content import',t=>{
  const paths=fixture(t),directory=path.join(path.dirname(paths[0]),'lifecycle'),before=paths.map(p=>fs.readFileSync(p));
  const built=buildHadithIndex({paths,directory});assert.equal(activeHadithIndex(directory),built.filename);assert.equal(built.pages,29);
  paths.forEach((p,i)=>assert.deepEqual(fs.readFileSync(p),before[i]));
  const source=new Database(paths[1]);source.prepare('UPDATE pages SET nass=? WHERE book_id=400').run('محتوى مجدد');source.close();
  assert.throws(()=>searchCore({paths,indexPath:built.filename,query:{q:'إنما',book:'muslim'}}),e=>e.code==='HADITH_INDEX_STALE');
  fs.writeFileSync(path.join(directory,'dirty'),'import');assert.equal(activeHadithIndex(directory),null);
  const next=buildHadithIndex({paths,directory});fs.rmSync(path.join(directory,'dirty'));
  assert.notEqual(next.filename,built.filename);assert(fs.existsSync(built.filename));
  assert.equal(searchCore({paths,indexPath:next.filename,query:{q:'محتوى مجدد',book:'muslim'}}).results[0].bookId,400);
  buildHadithIndex({paths,directory});assert(!fs.existsSync(built.filename));assert(fs.existsSync(next.filename));
});
test('phrase/all modes differ, punctuation is literal, page bounds and empty input are validated',t=>{
  const paths=fixture(t);
  // The conflicting Abu Dawud ID is excluded above; use an independent nonconflicting database here.
  const single=[paths[0]];
  const all=searchHadith({paths:single,query:{q:'إنما الأعمال بالنيات',group:'nine',book:'abu-dawud'}});assert.equal(all.results.length,1);
  const phrase=searchHadith({paths:single,query:{q:'إنما الأعمال بالنيات',group:'nine',book:'abu-dawud',matching:'phrase'}});assert.equal(phrase.results.length,0);
  for(const q of ['', '!', 'x'.repeat(301)])assert.throws(()=>hadithMatch(q));
  assert.deepEqual(hadithMatch('"إنما" OR الأعمال'),['انما','or','الاعمال']);assert.throws(()=>hadithMatch('إنما','unsafe'));
  for(const page of ['-1','1.5','101','abc'])assert.throws(()=>searchHadith({paths,query:{q:'إنما',page}}),/Halaman/);
  const missing=new Database(paths[1]);missing.exec('DROP TABLE pages_fts');missing.close();assert.equal(searchHadith({paths,query:{q:'إِنَّمَا',book:'muslim'}}).results.length,1);
});
test('HTTP worker endpoint searches real fixture text and rejects maintenance and invalid scope',async t=>{
  const paths=fixture(t);let busy=false;const events=[];const app=express();registerHadithSearch(app,{getPaths:()=>paths,isBusy:()=>busy,directory:path.join(path.dirname(paths[0]),'http-index'),onActivity:(req,event)=>events.push(event)});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}/api/hadith-books/search?`;
  let response;for(let attempt=0;attempt<30;attempt++){response=await fetch(base+new URLSearchParams({q:'إنما الأعمال',group:'two',book:'muslim'}));if(response.status!==202)break;await new Promise(r=>setTimeout(r,100));}assert.equal(response.status,200);const data=await response.json();assert.equal(data.results[0].bookId,400);assert.equal(data.scope.editions,1);
  assert.equal((await fetch(base+new URLSearchParams({q:'إنما',group:'none'}))).status,400);
  busy=true;assert.equal((await fetch(base+new URLSearchParams({q:'إنما'}))).status,409);
  assert.equal(events.length,1);assert.equal(events[0].action,'search');assert.equal(events[0].query,'إنما الأعمال');
  assert.equal(events[0].result_count,data.results.length);assert.equal(events[0].context.book,'muslim');assert.equal(events[0].context.mode,'content');
});
