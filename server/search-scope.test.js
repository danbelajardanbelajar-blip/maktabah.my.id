import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import {readSearchScope,searchScopeSql,registerSearchScope} from './search-scope.js';
import {searchPages} from './text-search.js';
import {countSuggestionResults} from './search-suggestions.js';
import {emptySearchScope,selectScopeCategory,toggleScopeBook,categorySelectedCount,scopeBookSelected,scopeParams,scopeFromParams,scopeKey,loadSearchScope,saveSearchScope} from '../src/lib/search-scope.ts';

function fixture(t){
 const db=new Database(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO categories VALUES(0,'Tanpa kategori'),(5,'فقه'),(6,'حديث'),(7,'Kosong');
 CREATE TABLE books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER);
 CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);
 CREATE VIRTUAL TABLE pages_fts USING fts5(nass,content='pages');
 CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN INSERT INTO pages_fts(rowid,nass) VALUES(new.rowid,new.nass);END;`);
 const b=db.prepare('INSERT INTO books_meta VALUES(?,?,?)'),p=db.prepare('INSERT INTO pages VALUES(1,?,1,1,?)');
 db.transaction(()=>{for(let id=1;id<=125;id++){b.run(id,`كتاب الفقه ${id}`,5);p.run(id,'نص الصلاة');}b.run(201,'كتاب الحديث',6);p.run(201,'نص الصلاة');b.run(202,'كتاب بلا تصنيف',null);p.run(202,'نص الصلاة');})();return db;
}
const textOptions=scope=>({exactPhrase:'"الصلاة"',scope});

test('category selection includes more than 100 books without expanding or listing their IDs',t=>{
 const db=fixture(t),scope=readSearchScope({scope:'custom',cats:'5'});
 const result=searchPages(db,textOptions(scope));assert.equal(result.total,125);assert.equal(result.results.length,50);
 assert.equal(searchPages(db,{...textOptions(scope),page:3,limit:50}).results.length,25);
 assert.equal(scope.books.length,0);
});

test('category/individual union, exclusions, explicit empty scope, all except category, and category zero are exact',t=>{
 const db=fixture(t);
 assert.equal(searchPages(db,textOptions(readSearchScope({scope:'custom',cats:'5',books:'201',notbooks:'1,2'}))).total,124);
 assert.deepEqual(searchPages(db,textOptions(readSearchScope({scope:'custom'}))).results,[]);
 assert.equal(searchPages(db,textOptions(readSearchScope({scope:'all',notcats:'5'}))).total,2);
 assert.equal(searchPages(db,textOptions(readSearchScope({scope:'all',notcats:'5',books:'1'}))).total,3);
 assert.equal(searchPages(db,textOptions(readSearchScope({scope:'custom',cats:'0'}))).total,1);
 assert.equal(searchPages(db,{...textOptions(readSearchScope({scope:'custom',books:'1,201'})),excludedBookIds:[1]}).total,1);
});

test('tri-state category and global selection preserve exceptions and promote a completed category',()=>{
 const category={id:5,name:'Fiqh',total:2},a={bkid:1,bk:'A',cat:5},b={bkid:2,bk:'B',cat:5};
 let scope=emptySearchScope(false);scope=toggleScopeBook(scope,a,category);assert.equal(categorySelectedCount(scope,category),1);
 scope=toggleScopeBook(scope,b,category);assert.deepEqual(scope.categories,[5]);assert.equal(scope.books.length,0);
 scope=toggleScopeBook(scope,a,category);assert.equal(categorySelectedCount(scope,category),1);assert.equal(scopeBookSelected(scope,b),true);
 scope=selectScopeCategory(scope,5,true);assert.equal(scope.excluded.length,0);assert.equal(categorySelectedCount(scope,category),2);
 scope=selectScopeCategory(emptySearchScope(),5,false);assert.deepEqual(scope.excludedCategories,[5]);
 scope=toggleScopeBook(scope,a,category);assert.equal(categorySelectedCount(scope,category),1);
});

test('URL round trips keep union and exceptions; legacy book links retain their original precedence',()=>{
 const scope={...emptySearchScope(false),categories:[0,5],books:[{bkid:201,bk:'Extra',cat:6}],excluded:[{bkid:1,bk:'A',cat:5}]};
 assert.equal(scopeKey(scopeFromParams(new URLSearchParams(scopeParams(scope)))),scopeKey(scope));
 assert.deepEqual(scopeFromParams(new URLSearchParams('cats=5&books=201')).categories,[]);
 assert.deepEqual(scopeFromParams(new URLSearchParams('cats=0,5')).categories,[0,5]);
 assert.equal(scopeFromParams(new URLSearchParams('scope=bad')).all,false);
 for(const query of [{scope:'bad'},{scope:'custom',books:'0'},{scope:'custom',cats:'1 OR 1=1'},{scope:'all',notbooks:'-1'},{scope:'custom',books:Array.from({length:1001},(_,i)=>i+1).join(',')}])assert.throws(()=>readSearchScope(query),e=>e.status===400);
 assert.equal(readSearchScope({cat_id:'5'}),null);
});

test('title predicates and suggestion validation obey the same selected scope',t=>{
 const db=fixture(t),scope=readSearchScope({scope:'custom',cats:'5',books:'201',notbooks:'1'}),where=searchScopeSql(scope);
 assert.equal(db.prepare(`SELECT COUNT(*) n FROM books_meta b WHERE ${where.sql}`).get(...where.params).n,125);
 assert.equal(countSuggestionResults(db,false,'الحديث','title',[],q=>q,1,readSearchScope({scope:'custom',cats:'5'})),0);
 assert.equal(countSuggestionResults(db,false,'الحديث','title',[],q=>q,1,scope),1);
});

test('scope catalogue lazily returns category counts, 30-book pages, normalized filters and selection hydration',async t=>{
 const db=fixture(t),app=express();registerSearchScope(app,{getDb:()=>db,hasAdditional:()=>false,categoriesSql:()=> 'categories'});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const get=async path=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`);return {status:r.status,...await r.json()};};
 const meta=await get('/api/search-scope?q='+encodeURIComponent('الْفِقْه')+'&ids=1&excluded=201');
 assert.equal(meta.categories.find(c=>c.id===5).total,125);assert.equal(meta.categories.find(c=>c.id===5).matched,125);assert.equal(meta.categories.find(c=>c.id===7).total,0);assert.equal(meta.books.length,2);
 const first=await get('/api/search-scope/books?category=5');assert.equal(first.data.length,30);assert.equal(first.total,125);
 const next=await get('/api/search-scope/books?category=5&page=2');assert.ok(next.data.every(b=>!first.data.some(a=>a.bkid===b.bkid)));
 assert.equal((await get('/api/search-scope/books?category=5&q='+encodeURIComponent('الحديث'))).total,0);
 assert.equal((await get('/api/search-scope/books?category=-1')).status,400);
});

test('attached metadata uses primary identity and scoped searches cover additional categories',t=>{
 const db=fixture(t);db.exec(`ATTACH DATABASE ':memory:' AS tambahan;
 CREATE TABLE tambahan.books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER);CREATE TABLE tambahan.pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);
 CREATE VIRTUAL TABLE tambahan.pages_fts USING fts5(nass,content='pages');INSERT INTO tambahan.books_meta VALUES(301,'إضافي',8);INSERT INTO tambahan.pages VALUES(1,301,1,1,'نص الصلاة');INSERT INTO tambahan.pages_fts(pages_fts) VALUES('rebuild');`);
 assert.equal(searchPages(db,{...textOptions(readSearchScope({scope:'custom',cats:'5,8'})),additional:true}).total,126);
});

test('device persistence migrates the previous selected-book list and preserves the new scope',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
 try{
  values.set('maktabah:search-books-active','1');values.set('maktabah:search-books',JSON.stringify([{bkid:7,bk:'Saved'}]));
  assert.equal(loadSearchScope().all,false);assert.equal(loadSearchScope().books[0].bkid,7);
  const scope={...emptySearchScope(false),categories:[5],excluded:[{bkid:1,bk:'Excluded',cat:5}]};saveSearchScope(scope);
  assert.equal(scopeKey(loadSearchScope()),scopeKey(scope));
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
