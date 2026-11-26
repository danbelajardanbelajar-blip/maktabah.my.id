import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { createManualBook, createManualPage, registerManualBook } from './manual-book.js';

function createFixture(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, catord INTEGER, lvl INTEGER);
    CREATE TABLE authors (authid INTEGER PRIMARY KEY, auth TEXT, inf TEXT, HigriD TEXT, AD TEXT);
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);
    CREATE TABLE pages (id INTEGER, book_id INTEGER, part INTEGER, page INTEGER, seal TEXT, nass TEXT, PRIMARY KEY(book_id, id));
    INSERT INTO categories VALUES (1, 'Fikih', 1, 0), (2, 'Hadis', 2, 0);
    INSERT INTO authors VALUES (10, 'الإمام النووي', NULL, NULL, NULL);
    INSERT INTO books_meta VALUES (5, 'المجموع', 1, 10, NULL, NULL);
  `);
  return db;
}

test('createManualBook creates book with existing or new author and optional initial page', (t) => {
  const db = createFixture(t);

  // Reuse existing author + add initial page
  const b1 = createManualBook(db, {
    title: 'الأذكار للنووي',
    catId: 2,
    author: 'الإمام النووي',
    inf: 'Kitab zikir pilihan',
    initialPart: 1,
    initialPage: 1,
    initialNass: 'باب النية في الأعمال',
  });
  assert.equal(b1.bkid, 6);
  assert.equal(b1.authno, 10);
  assert.equal(b1.initialPageId, 1);

  const pageRow = db.prepare('SELECT * FROM pages WHERE book_id = 6').get();
  assert.equal(pageRow.nass, 'باب النية في الأعمال');

  // Create new author + book without initial page
  const b2 = createManualBook(db, {
    title: 'رسالة جديدة',
    catId: 1,
    author: 'مؤلف جديد',
  });
  assert.equal(b2.bkid, 7);
  assert.equal(b2.authno, 11);
  assert.equal(b2.initialPageId, null);
  assert.equal(db.prepare('SELECT auth FROM authors WHERE authid = 11').get().auth, 'مؤلف جديد');
});

test('createManualBook rejects empty title or unknown category', (t) => {
  const db = createFixture(t);
  assert.throws(() => createManualBook(db, { title: '   ', catId: 1 }), (e) => e.status === 400);
  assert.throws(() => createManualBook(db, { title: 'Valid', catId: 999 }), (e) => e.status === 404);
});

test('createManualPage increments page id and auto-increments page number when omitted', (t) => {
  const db = createFixture(t);
  const p1 = createManualPage(db, 5, { part: 1, page: 10, nass: 'Halaman pertama' });
  assert.deepEqual(p1, { id: 1, book_id: 5, part: 1, page: 10 });

  const p2 = createManualPage(db, 5, { part: 1, nass: 'Halaman kedua' });
  assert.deepEqual(p2, { id: 2, book_id: 5, part: 1, page: 11 });

  assert.throws(() => createManualPage(db, 5, { nass: '  ' }), (e) => e.status === 400);
  assert.throws(() => createManualPage(db, 999, { nass: 'Teks' }), (e) => e.status === 404);
});

test('registerManualBook exposes protected POST endpoints and invalidates cache', async (t) => {
  const db = createFixture(t);
  const app = express();
  app.use(express.json());
  let invalidated = 0;
  let forgotten = null;
  const requireAdmin = (req, res, next) => {
    if (req.headers.authorization !== 'Bearer ok') return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  registerManualBook(app, {
    getDb: () => db,
    getStateDb: () => null,
    requireAdmin,
    hasAdditional: () => false,
    invalidateCache: () => { invalidated++; },
    forgetPolicyBook: (_, bkid) => { forgotten = bkid; },
  });

  const server = app.listen(0);
  t.after(() => server.close());
  const port = server.address().port;

  const unauth = await fetch(`http://127.0.0.1:${port}/api/admin/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', catId: 1 }),
  });
  assert.equal(unauth.status, 401);

  const created = await fetch(`http://127.0.0.1:${port}/api/admin/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ok' },
    body: JSON.stringify({ title: 'كتاب يدوي', catId: 1 }),
  });
  assert.equal(created.status, 201);
  const cJson = await created.json();
  assert.equal(cJson.book.bkid, 6);
  assert.equal(invalidated, 1);

  const addedPage = await fetch(`http://127.0.0.1:${port}/api/admin/book/6/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ok' },
    body: JSON.stringify({ part: 1, page: 1, nass: 'نص الصفحة الأولى' }),
  });
  assert.equal(addedPage.status, 201);
  assert.equal(invalidated, 2);
  assert.equal(forgotten, 6);
});
