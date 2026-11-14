import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {normalizeSuggestion, wordDistance, registerSearchSuggestions} from './search-suggestions.js';

const key = 'AIza' + 'a'.repeat(35);
const response = suggestions => new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({suggestions})}]}}]}));
const likeMatch = query => query.replace(/[\u064B-\u065F\u0670]/g,'').replace(/[اأإآ]/g,'_').replace(/[يى](?=\s|$)/g,'_').replace(/[هة](?=\s|$)/g,'_');

async function fixture(t, options = {}) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER);
    CREATE TABLE pages(id INTEGER PRIMARY KEY,book_id INTEGER,nass TEXT);
    CREATE VIRTUAL TABLE pages_fts USING fts5(nass,content='pages');
    INSERT INTO books_meta VALUES(1,'صلاة التهجد',10),(2,'كتاب الفقه',20),(3,'shalat tahajud',10);
    INSERT INTO pages VALUES(1,1,'صلاة التهجد في الليل'),(2,2,'كتاب الفقه'),(3,3,'shalat tahajud malam');
    INSERT INTO pages_fts(pages_fts) VALUES('rebuild');`);
  const app = express();
  registerSearchSuggestions(app, {getDb:()=>db,hasAdditional:()=>false,likeMatch,configPath:'nonexistent-test-config',localExportMode:false,env:{},...options});
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const request = async (q, mode='text', cat_id='') => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/search-suggestions?${new URLSearchParams({q,mode,cat_id})}`);
    return {status:res.status, ...await res.json()};
  };
  return {db,request};
}

test('normalization handles harakat, tatweel and Arabic letter variants; distance handles transpositions',()=>{
  assert.equal(normalizeSuggestion('إِلَـى الصَّلاة'), 'الي الصلاة');
  assert.equal(wordDistance('tahajdu','tahajud'),1);
  assert.equal(wordDistance('abc','abcdef'),3);
});

test('catalogue corrects typos for text/title and respects categories without AI',async t=>{
  let calls=0;
  const {request} = await fixture(t,{fetchImpl:async()=>{calls++;throw Error('must not call');}});
  assert.ok((await request('tahajdu')).suggestions.includes('tahajud'));
  assert.ok((await request('tahajdu','title','10')).suggestions.includes('tahajud'));
  assert.deepEqual((await request('tahajdu','title','20')).suggestions,[]);
  assert.ok((await request('الفقخ','text','20')).suggestions.includes('الفقه'));
  assert.equal(calls,0);
});

test('AI alternatives are verified, deduplicated, cached by mode/category, and cannot inject markup or FTS',async t=>{
  let calls=0;
  const {request} = await fixture(t,{env:{GEMINI_API_KEY:key},fetchImpl:async()=>{
    calls++;return response(['صلاة التهجد','صلاة التهجد','invented book','<script>alert(1)</script>','" OR *']);
  }});
  assert.deepEqual((await request('solat tahajut','text','10')).suggestions,['shalat tahajud','صلاة التهجد']);
  assert.deepEqual((await request('solat tahajut','text','10')).suggestions,['shalat tahajud','صلاة التهجد']);
  assert.equal(calls,1);
  assert.deepEqual((await request('solat tahajut','text','20')).suggestions,[]);
  assert.equal(calls,2);
  assert.deepEqual((await request('solat tahajut','title','10')).suggestions,['shalat tahajud','صلاة التهجد']);
  assert.equal(calls,3);
});

test('positive searches, invalid inputs, maintenance and local export never consume provider quota',async t=>{
  let calls=0, busy=false;
  const {request} = await fixture(t,{env:{GEMINI_API_KEY:key},isMaintenance:()=>busy,fetchImpl:async()=>{calls++;return response([]);}});
  assert.deepEqual((await request('صلاة')).suggestions,[]);
  assert.deepEqual((await request('shalat','title')).suggestions,[]);
  assert.equal((await request('a'.repeat(121))).status,400);
  assert.equal((await request('missing','pdf')).status,400);
  assert.equal((await request('missing','text','1 OR 1=1')).status,400);
  busy=true;
  assert.deepEqual((await request('tahajdu')).suggestions,[]);
  assert.equal(calls,0);
  const local=await fixture(t,{env:{GEMINI_API_KEY:key},localExportMode:true,fetchImpl:async()=>{calls++;return response([]);}});
  assert.ok((await local.request('tahajdu')).suggestions.includes('tahajud'));
  assert.equal(calls,0);
});

test('AI failure retains local suggestions and cache revalidates after data deletion',async t=>{
  const {db,request}=await fixture(t,{env:{GEMINI_API_KEY:key},fetchImpl:async()=>{throw Error('offline');}});
  assert.ok((await request('tahajdu','title')).suggestions.includes('tahajud'));
  db.prepare('DELETE FROM books_meta WHERE bkid=3').run();
  assert.deepEqual((await request('tahajdu','title')).suggestions,[]);
});

test('concurrent requests share one provider call and request limits bound public usage',async t=>{
  let calls=0, release;
  const gate = new Promise(resolve=>{release=resolve;});
  const {request}=await fixture(t,{env:{GEMINI_API_KEY:key},fetchImpl:async()=>{calls++;await gate;return response(['صلاة التهجد']);}});
  const a=request('solat tahajut'), b=request('solat tahajut');
  await new Promise(resolve=>setTimeout(resolve,50));release();
  assert.deepEqual((await a).suggestions,['shalat tahajud','صلاة التهجد']);
  assert.deepEqual((await b).suggestions,['shalat tahajud','صلاة التهجد']);
  assert.equal(calls,1);
  for(let i=0;i<10;i++) await request('صلاة');
  assert.equal((await request('another missing')).status,429);
  assert.equal(calls,1);
});

test('additional database results are verified in their own schema',async t=>{
  const {db,request}=await fixture(t,{hasAdditional:()=>true});
  db.exec(`ATTACH DATABASE ':memory:' AS tambahan;
    CREATE TABLE tambahan.books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER);
    CREATE TABLE tambahan.pages(id INTEGER PRIMARY KEY,book_id INTEGER,nass TEXT);
    CREATE VIRTUAL TABLE tambahan.pages_fts USING fts5(nass,content='pages');
    INSERT INTO tambahan.books_meta VALUES(4,'الزكاة',30);
    INSERT INTO tambahan.pages VALUES(4,4,'الزكاة');
    INSERT INTO tambahan.pages_fts(pages_fts) VALUES('rebuild');`);
  assert.ok((await request('الزكات','text','30')).suggestions.includes('الزكاة'));
  assert.deepEqual((await request('الزكات','text','10')).suggestions,[]);
});

test('three verified local alternatives avoid AI and prefer frequent catalogue terms',async t=>{
  let calls=0;
  const {db,request}=await fixture(t,{env:{GEMINI_API_KEY:key},fetchImpl:async()=>{calls++;return response([]);}});
  db.exec(`INSERT INTO books_meta VALUES(4,'الفقر',20),(5,'الفقة',20),(6,'الفقع',20),(7,'دروس الفقه',20);`);
  const result=await request('الفقخ','title','20');
  assert.equal(result.suggestions[0],'الفقه');
  assert.equal(result.suggestions.length,3);
  assert.ok(!result.suggestions.includes('الفقة'));
  assert.equal(calls,0);
});
