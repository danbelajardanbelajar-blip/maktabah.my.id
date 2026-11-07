import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {categoryBooks} from './catalogue.js';
test('category zero supports title filtering, bounded pagination and the legacy unpaginated response',()=>{
  const db=new Database(':memory:');try{
    db.exec('CREATE TABLE books_meta(bkid INTEGER,bk TEXT,cat INTEGER,authno INTEGER); CREATE TABLE authors(authid INTEGER,auth TEXT);');
    for(let i=1;i<=7;i++)db.prepare('INSERT INTO books_meta VALUES(?,?,0,NULL)').run(i,`Book ${i}`);
    assert.equal(categoryBooks(db,{categoryId:0,page:2,limit:3}).data[0].bkid,4);
    assert.equal(categoryBooks(db,{categoryId:0,page:999,limit:3}).page,3);
    assert.equal(categoryBooks(db,{categoryId:0,query:'Book 7'}).total,1);
    assert.equal(categoryBooks(db,{categoryId:0,paging:false}).data.length,7);
    assert.throws(()=>categoryBooks(db,{categoryId:NaN}),/tidak valid/);
  }finally{db.close();}
});
