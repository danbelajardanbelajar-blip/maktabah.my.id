import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {resolveAiSource,exactSourceQuote} from './ai-source.js';
test('page zero, attached database, Arabic marks and oversized/forged input',()=>{
 const db=new Database(':memory:');
 try {
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part TEXT,page TEXT,nass TEXT);ATTACH DATABASE ':memory:' AS tambahan;CREATE TABLE tambahan.books_meta(bkid INTEGER,bk TEXT);CREATE TABLE tambahan.pages(id INTEGER,book_id INTEGER,part TEXT,page TEXT,nass TEXT);");
 db.prepare('INSERT INTO books_meta VALUES(1,?)').run('أصل');
 db.prepare('INSERT INTO pages VALUES(0,1,1,1,?)').run('<p>صَلَاةُ الجماعة</p>');
 db.prepare('INSERT INTO tambahan.books_meta VALUES(2,?)').run('إضافة');
 db.prepare('INSERT INTO tambahan.pages VALUES(3,2,1,2,?)').run('نص إضافي');
 assert.equal(resolveAiSource(db,{bookId:1,pageId:0,text:'صلاة الجماعة'}).reference.excerpt,'صَلَاةُ الجماعة');
 assert.equal(exactSourceQuote('A & B','Z'),null);
 assert.equal(resolveAiSource(db,{bookId:2,pageId:3},true).reference.title,'إضافة');
 assert.throws(()=>resolveAiSource(db,{bookId:2,pageId:0},true),e=>e.status===404);
 db.prepare('UPDATE pages SET nass=?').run('x'.repeat(9000));
 assert.throws(()=>resolveAiSource(db,{bookId:1,pageId:0}),e=>e.status===413);
 assert.equal(resolveAiSource(db,{bookId:1,pageId:0,text:'x'.repeat(100)}).reference.excerpt.length,100);
 }finally{db.close();}
});
