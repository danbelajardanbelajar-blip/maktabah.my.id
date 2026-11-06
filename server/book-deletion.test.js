import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import express from 'express';
import { deleteCatalogue, registerBookDeletion } from './book-deletion.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-delete-'));
  const filename = path.join(directory, 'test.db');
  fs.copyFileSync(new URL('../dev-data/seed/maktabah.db', import.meta.url), filename);
  const db = new Database(filename);
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  db.prepare("INSERT INTO books_meta(bkid,bk,cat) VALUES(3,'Unrelated book',NULL)").run();
  db.prepare('UPDATE books_meta SET cat=99001 WHERE bkid IN (1,2)').run();
  db.prepare("INSERT INTO categories(id,name) VALUES(99001,'Delete test')").run();
  db.prepare("UPDATE pages SET nass='deletionuniqueword' WHERE book_id=1").run();
  db.exec("INSERT INTO book_pdf VALUES(1,'shared.pdf',1); INSERT INTO book_shorts VALUES(1,'x','note'); INSERT INTO user_comments VALUES(1,1,'comment'); INSERT INTO matn_sharh_books VALUES(1,1,3,1); INSERT INTO matn_sharh_pages VALUES(3,1,1,1); INSERT INTO tafsir_mapping VALUES(1,1,1,1); INSERT INTO tafsir_ayah_mapping VALUES(1,1,1,1,0);");
  db.exec("ATTACH DATABASE ':memory:' AS tafsir; CREATE TABLE tafsir.tafsir_ayah_mapping(tafsir_bkid INTEGER); INSERT INTO tafsir.tafsir_ayah_mapping VALUES(1),(3);");
  return db;
}

function assertClean(db) {
  for (const [table, column] of [['books_meta','bkid'],['pages','book_id'],['titles','book_id'],['book_pdf','bkid'],['book_shorts','bk'],['user_comments','bk'],['tafsir_mapping','tafsir_bkid'],['tafsir_ayah_mapping','tafsir_bkid']]) {
    assert.equal(db.prepare(`SELECT count(*) n FROM ${table} WHERE ${column}=1`).get().n, 0, table);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM matn_sharh_books WHERE matn=1 OR sharh=1').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM matn_sharh_pages WHERE matn=1 OR sharh=1').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM tafsir.tafsir_ayah_mapping WHERE tafsir_bkid=1').get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM pages_fts WHERE pages_fts MATCH 'deletionuniqueword'").get().n,0);
  db.prepare("INSERT INTO pages_fts(pages_fts,rank) VALUES('integrity-check',1)").run();
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
}

test('single book deletion removes content, search index and relationships while preserving other books and authors', t => {
  const db=fixture(t), authors=db.prepare('SELECT count(*) n FROM authors').get().n;
  const result=deleteCatalogue(db,{bookIds:[1],hasTafsir:true});
  assert.equal(result.books,1); assert.ok(result.pages>0); assert.ok(result.titles>0);
  assertClean(db);
  assert.ok(db.prepare('SELECT 1 FROM books_meta WHERE bkid=3').get());
  assert.equal(db.prepare('SELECT count(*) n FROM authors').get().n,authors);
  assert.equal(db.prepare('SELECT count(*) n FROM tafsir.tafsir_ayah_mapping WHERE tafsir_bkid=3').get().n,1);
});

test('category deletion cascades to all its books, and bulk deletion deduplicates IDs', t => {
  const db=fixture(t);
  const result=deleteCatalogue(db,{categoryId:99001,hasTafsir:true});
  assert.equal(result.books,2);assert.equal(result.categories,1);assertClean(db);
  assert.equal(db.prepare('SELECT count(*) n FROM books_meta WHERE cat=99001').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM categories WHERE id=99001').get().n,0);
  assert.equal(deleteCatalogue(db,{bookIds:[3,3]}).books,1);
});

test('failure after deleting related records rolls back pages, index, metadata and attached mappings', t => {
  const db=fixture(t);
  db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON books_meta WHEN old.bkid=1 BEGIN SELECT raise(ABORT,'forced rollback'); END;");
  assert.throws(()=>deleteCatalogue(db,{categoryId:99001,hasTafsir:true}),/forced rollback/);
  for(const [table,col] of [['books_meta','bkid'],['pages','book_id'],['titles','book_id'],['book_pdf','bkid']])assert.ok(db.prepare(`SELECT 1 FROM ${table} WHERE ${col}=1`).get());
  assert.ok(db.prepare('SELECT 1 FROM tafsir.tafsir_ayah_mapping WHERE tafsir_bkid=1').get());
  assert.ok(db.prepare("SELECT rowid FROM pages_fts WHERE pages_fts MATCH 'deletionuniqueword'").get());
  assert.ok(db.prepare('SELECT 1 FROM categories WHERE id=99001').get());
});

test('invalid IDs, missing categories and read-only additional sources cannot delete data', t => {
  const db=fixture(t);
  for(const bookIds of [[],[0],[1.1],['1'],null])assert.throws(()=>deleteCatalogue(db,{bookIds}),/tidak valid/);
  assert.throws(()=>deleteCatalogue(db,{categoryId:999999}),/tidak ditemukan/);
  db.exec('ATTACH DATABASE ":memory:" AS tambahan; CREATE TABLE tambahan.books_meta(bkid INTEGER,cat INTEGER); INSERT INTO tambahan.books_meta VALUES(100,99001);');
  assert.throws(()=>deleteCatalogue(db,{categoryId:99001,hasAdditional:true}),/hanya dapat dibaca/);
  assert.ok(db.prepare('SELECT 1 FROM books_meta WHERE bkid=1').get());
});

test('HTTP deletion requires admin, validates exact IDs and clears cache only on success', async t => {
  const db=fixture(t), app=express();app.use(express.json());let cleared=0;
  registerBookDeletion(app,{getDb:()=>db,requireAdmin:(req,res,next)=>req.headers.authorization==='Bearer test'?next():res.sendStatus(401),clearCache:()=>cleared++,hasAdditional:()=>false,hasTafsir:()=>true});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const base=`http://127.0.0.1:${server.address().port}/api/admin`;
    assert.equal((await fetch(`${base}/category/99001`,{method:'DELETE'})).status,401);
    const headers={Authorization:'Bearer test','Content-Type':'application/json'};
    assert.equal((await fetch(`${base}/book/1junk`,{method:'DELETE',headers})).status,400);
    assert.equal(cleared,0);
    const response=await fetch(`${base}/category/99001`,{method:'DELETE',headers});
    assert.equal(response.status,200);assert.equal((await response.json()).deleted.books,2);assert.equal(cleared,1);assertClean(db);
    assert.equal((await fetch(`${base}/books/bulk-delete`,{method:'DELETE',headers,body:JSON.stringify({bookIds:[]})})).status,400);
  } finally {await new Promise(r=>server.close(r));}
});
