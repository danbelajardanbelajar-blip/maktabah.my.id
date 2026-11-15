import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {searchPages,searchPagesOffThread,SEARCH_COUNT_CAP} from './text-search.js';

function library(t,{tambahan=false}={}) {
  const db=new Database(':memory:');t.after(()=>db.close());
  const create=schema=>db.exec(`CREATE TABLE ${schema}.books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER);CREATE TABLE ${schema}.pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);
    CREATE VIRTUAL TABLE ${schema}.pages_fts USING fts5(nass,content='pages');
    CREATE TRIGGER ${schema}.pages_ai AFTER INSERT ON pages BEGIN INSERT INTO pages_fts(rowid,nass) VALUES(new.rowid,new.nass);END;`);
  create('main');
  if(tambahan){db.exec("ATTACH DATABASE ':memory:' AS tambahan");create('tambahan');}
  return db;
}

test('exact phrase hits come first, then pages with all words; paging crosses the boundary',t=>{
  const db=library(t);db.prepare('INSERT INTO books_meta VALUES(1,?,5)').run('كتاب');
  const put=db.prepare('INSERT INTO pages VALUES(?,1,1,?,?)');
  put.run(1,1,'اتباع غير المستفتي للفتوى');put.run(2,2,'للفتوى اتباع المستفتي غير');put.run(3,3,'شيء آخر');
  const match={exactPhrase:'"اتباع غير المستفتي للفتوى"',andMatch:'("اتباع" AND "غير" AND "المستفتي" AND "للفتوى") NOT "اتباع غير المستفتي للفتوى"'};
  const all=searchPages(db,{...match,limit:50});
  assert.deepEqual(all.results.map(r=>[r.page_id,r.is_exact]),[[1,1],[2,0]]);assert.equal(all.total,2);assert.equal(all.capped,false);
  assert.ok(all.results[0].snippet.includes('<b>'));assert.equal(all.results[0].book_name,'كتاب');
  assert.deepEqual(searchPages(db,{...match,page:2,limit:1}).results.map(r=>r.page_id),[2]);
  assert.deepEqual(searchPages(db,{...match,catIds:[9]}).results,[]);assert.equal(searchPages(db,{...match,catIds:[5]}).total,2);
  assert.equal(searchPages(db,{...match,bookId:2}).total,0);
});

test('a common word counts only up to the cap and still returns its first page quickly',t=>{
  const db=library(t);db.prepare('INSERT INTO books_meta VALUES(1,?,5)').run('كتاب');
  const put=db.prepare('INSERT INTO pages VALUES(?,1,1,?,?)');
  db.transaction(()=>{for(let i=1;i<=SEARCH_COUNT_CAP+50;i++)put.run(i,i,'قال الله تعالى');})();
  const started=Date.now();const result=searchPages(db,{exactPhrase:'"الله"',limit:50});
  assert.equal(result.total,SEARCH_COUNT_CAP);assert.equal(result.capped,true);assert.equal(result.results.length,50);
  assert.ok(Date.now()-started<5000);
});

test('both libraries are searched in order with metadata from either one',t=>{
  const db=library(t,{tambahan:true});
  db.prepare('INSERT INTO main.books_meta VALUES(1,?,5)').run('أصل');db.prepare('INSERT INTO tambahan.books_meta VALUES(2,?,6)').run('إضافي');
  db.prepare('INSERT INTO main.pages VALUES(1,1,1,1,?)').run('حكم الصلاة');db.prepare('INSERT INTO tambahan.pages VALUES(1,2,1,1,?)').run('حكم الصلاة أيضا');
  const result=searchPages(db,{exactPhrase:'"حكم الصلاة"',limit:50,additional:true});
  assert.deepEqual(result.results.map(r=>r.book_name),['أصل','إضافي']);assert.equal(result.total,2);
  assert.deepEqual(searchPages(db,{exactPhrase:'"حكم الصلاة"',limit:50,additional:true,catIds:[6]}).results.map(r=>r.book_id),[2]);
  assert.deepEqual(searchPages(db,{exactPhrase:'"حكم الصلاة"',limit:1,page:2,additional:true}).results.map(r=>r.book_id),[2]);
});

test('file-backed searches run in a read-only worker with the same results and a time limit',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'maktabah-search-'));
  const db=new Database(path.join(dir,'library.db'));
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
  db.exec(`CREATE TABLE books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);
    CREATE VIRTUAL TABLE pages_fts USING fts5(nass,content='pages');
    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN INSERT INTO pages_fts(rowid,nass) VALUES(new.rowid,new.nass);END;`);
  db.prepare('INSERT INTO books_meta VALUES(1,?,5)').run('كتاب');db.prepare('INSERT INTO pages VALUES(1,1,1,1,?)').run('حكم الصلاة');
  const options={exactPhrase:'"حكم الصلاة"',limit:50};
  assert.deepEqual(await searchPagesOffThread(db,options),searchPages(db,options));
  await assert.rejects(searchPagesOffThread(db,options,{timeout:1}),e=>e.code==='SEARCH_TIMEOUT'&&e.status===504);
});
