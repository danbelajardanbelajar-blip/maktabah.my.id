import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import { exportBooks, importBooks, registerBookTransfer } from './book-transfer.js';

const seed = fileURLToPath(new URL('../dev-data/seed/maktabah.db', import.meta.url));
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-transfer-'));
  const filename = path.join(directory, 'test.db');
  fs.copyFileSync(seed, filename);
  const db = new Database(filename);
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const ids = db.prepare('SELECT bkid FROM books_meta ORDER BY bkid LIMIT 2').all().map(b => b.bkid);
  return { db, filename, directory, ids };
}
const clearBooks = db => db.exec('DELETE FROM titles; DELETE FROM pages; DELETE FROM books_meta; DELETE FROM categories; DELETE FROM authors;');

test('round trip preserves Arabic pages, contents, authors and search index', t => {
  const { db, ids } = fixture(t);
  const payload = exportBooks(db, ids);
  const expected = structuredClone(payload.books);
  clearBooks(db);
  const result = importBooks(db, JSON.parse(JSON.stringify(payload)));
  assert.equal(result.imported, 2);
  assert.equal(result.pages, expected.reduce((n, b) => n + b.pages.length, 0));
  assert.deepEqual(exportBooks(db, ids).books, expected);
  assert.ok(db.prepare("SELECT rowid FROM pages_fts WHERE pages_fts MATCH 'الله' LIMIT 1").get());
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  db.prepare("INSERT INTO pages_fts(pages_fts,rank) VALUES('integrity-check',1)").run();
});

test('existing book IDs are skipped without overwriting content, including additional database IDs', t => {
  const { db, ids } = fixture(t);
  const payload = exportBooks(db, ids);
  payload.books[0].book.bk = 'Must never overwrite';
  assert.equal(importBooks(db, payload).skipped.length, 2);
  assert.notEqual(db.prepare('SELECT bk FROM books_meta WHERE bkid=?').get(ids[0]).bk, 'Must never overwrite');
  clearBooks(db);
  const result = importBooks(db, payload, id => id === ids[0]);
  assert.equal(result.imported, 1);
  assert.equal(result.skipped[0].bkid, ids[0]);
});

test('category and author ID collisions are remapped, leaving existing metadata intact', t => {
  const { db, ids } = fixture(t);
  const payload = exportBooks(db, [ids[0]]);
  const { category, author } = payload.books[0];
  assert.ok(category && author);
  clearBooks(db);
  db.prepare('INSERT INTO categories (id,name) VALUES (?,?)').run(category.id, 'Existing category');
  db.prepare('INSERT INTO authors (authid,auth) VALUES (?,?)').run(author.authid, 'Existing author');
  importBooks(db, payload);
  const result = exportBooks(db, [ids[0]]).books[0];
  assert.notEqual(result.book.cat, category.id);
  assert.notEqual(result.book.authno, author.authid);
  assert.equal(result.category.name, category.name);
  assert.equal(result.author.auth, author.auth);
  assert.equal(db.prepare('SELECT name FROM categories WHERE id=?').get(category.id).name, 'Existing category');
});

test('invalid later books reject the entire package before writing', t => {
  const { db, ids } = fixture(t);
  const payload = exportBooks(db, ids);
  clearBooks(db);
  payload.books[1].pages[0].book_id = -1;
  assert.throws(() => importBooks(db, payload), /tidak valid/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM books_meta').get().n, 0);
});

test('SQL failures roll back all inserted books, pages and search entries', t => {
  const { db, ids } = fixture(t);
  const payload = exportBooks(db, ids);
  clearBooks(db);
  db.exec(`CREATE TRIGGER test_failure BEFORE INSERT ON books_meta WHEN new.bkid=${ids[1]} BEGIN SELECT raise(ABORT,'forced failure'); END`);
  assert.throws(() => importBooks(db, payload), /forced failure/);
  for (const table of ['books_meta', 'pages', 'titles', 'categories', 'authors']) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  db.prepare("INSERT INTO pages_fts(pages_fts,rank) VALUES('integrity-check',1)").run();
});

test('HTTP endpoints require admin and create a readable pre-import backup', async t => {
  const { db, filename, directory, ids } = fixture(t);
  const payload = exportBooks(db, [ids[0]]);
  clearBooks(db);
  const app = express();
  app.use(express.json());
  registerBookTransfer(app, {
    getDb: () => db, getDbPath: () => filename,
    requireAdmin: (req, res, next) => req.headers.authorization === 'Bearer test' ? next() : res.sendStatus(401),
    hasAdditional: () => false, clearCache: () => {},
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/books/`;
  try {
    for (const action of ['import', 'export']) assert.equal((await fetch(base + action, { method: 'POST' })).status, 401);
    const r = await fetch(base + 'import', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.imported, 1);
    const backup = new Database(path.join(directory, 'book-import-backups', result.backup), { readonly: true });
    assert.equal(backup.prepare('SELECT count(*) AS n FROM books_meta').get().n, 0);
    assert.equal(backup.pragma('integrity_check', { simple: true }), 'ok');
    backup.close();
    const exported = await fetch(base + 'export', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify({ bookIds: [ids[0]] }) });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition'), /attachment/);
    assert.deepEqual((await exported.json()).books, payload.books);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
