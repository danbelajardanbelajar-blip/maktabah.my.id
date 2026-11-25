import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { queryAutocomplete, registerSearchAutocomplete } from './search-autocomplete.js';

function createFixture(t) {
  const db = new Database(':memory:');
  const stateDb = new Database(':memory:');
  t.after(() => {
    db.close();
    stateDb.close();
  });

  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER);
    INSERT INTO categories VALUES (1, 'Fikih'), (2, 'Hadis');
    INSERT INTO books_meta VALUES
      (1, 'صحيح البخاري', 2),
      (2, 'فتح الباري شرح صحيح البخاري', 2),
      (3, 'نهاية المحتاج إلى شرح المنهاج', 1),
      (4, 'تحفة المحتاج في شرح المنهاج', 1),
      (99, 'كتاب محظور', 1);
  `);

  stateDb.exec(`
    CREATE TABLE search_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT, result_count INTEGER);
    INSERT INTO search_logs (query, result_count) VALUES
      ('shalat jumat', 15),
      ('Shalat Jumat', 20),
      ('shalat dhuha', 8),
      ('shalat gaib kosong', 0),
      ('صحيح مسلم', 10),
      ('صحيح البخاري', 5);
  `);

  return { db, stateDb };
}

test('queryAutocomplete returns matching books and popular queries while respecting exclusions and 0-result filter', (t) => {
  const { db, stateDb } = createFixture(t);
  const excluded = new Set([99]);

  // Arabic book search: 'صحيح'
  const arRes = queryAutocomplete({
    db,
    stateDb,
    getExcludedBookIds: () => excluded,
    query: 'صحيح',
  });

  // Should prioritize prefix match 'صحيح البخاري' over 'فتح البخاري شرح صحيح البخاري'
  assert.equal(arRes.books.length, 2);
  assert.equal(arRes.books[0].title, 'صحيح البخاري');
  assert.equal(arRes.books[0].category, 'Hadis');
  assert.equal(arRes.books[1].title, 'فتح الباري شرح صحيح البخاري');

  // 'صحيح البخاري' in search_logs should be skipped because it duplicates book title; 'صحيح مسلم' should appear
  assert.equal(arRes.queries.length, 1);
  assert.equal(arRes.queries[0].text, 'صحيح مسلم');

  // Excluded book should never appear
  const exclRes = queryAutocomplete({
    db,
    stateDb,
    getExcludedBookIds: () => excluded,
    query: 'محظور',
  });
  assert.equal(exclRes.books.length, 0);

  // Indonesian query search: 'shalat'
  const idRes = queryAutocomplete({
    db,
    stateDb,
    query: 'shalat',
  });
  assert.equal(idRes.queries.length, 2);
  assert.equal(idRes.queries[0].text.toLowerCase(), 'shalat jumat');
  assert.equal(idRes.queries[0].count, 2);
  assert.equal(idRes.queries[1].text.toLowerCase(), 'shalat dhuha');
  // 'shalat gaib kosong' (result_count = 0) must not be suggested
  assert.ok(!idRes.queries.some((q) => q.text.includes('kosong')));
});

test('queryAutocomplete ignores too-short queries', (t) => {
  const { db, stateDb } = createFixture(t);
  assert.deepEqual(queryAutocomplete({ db, stateDb, query: 'a' }), { books: [], queries: [] });
  assert.deepEqual(queryAutocomplete({ db, stateDb, query: '' }), { books: [], queries: [] });
});

test('registerSearchAutocomplete caches responses and handles maintenance mode', async (t) => {
  const { db, stateDb } = createFixture(t);
  let maintenance = false;
  let currentTime = 1000;
  const app = express();

  registerSearchAutocomplete(app, {
    getDb: () => db,
    getStateDb: () => stateDb,
    hasAdditional: () => false,
    likeMatch: (s) => s,
    getExcludedBookIds: () => new Set(),
    isMaintenance: () => maintenance,
    now: () => currentTime,
  });

  const server = app.listen(0);
  t.after(() => server.close());
  const port = server.address().port;

  // Initial request
  const r1 = await fetch(`http://127.0.0.1:${port}/api/autocomplete?q=shalat`);
  assert.equal(r1.status, 200);
  const j1 = await r1.json();
  assert.equal(j1.queries.length, 2);

  // Insert new log; cache should still return 2 items within TTL
  stateDb.prepare("INSERT INTO search_logs(query, result_count) VALUES ('shalat tahajud', 12)").run();
  const r2 = await fetch(`http://127.0.0.1:${port}/api/autocomplete?q=shalat`);
  const j2 = await r2.json();
  assert.equal(j2.queries.length, 2);

  // Advance clock past 2 min TTL
  currentTime += 130_000;
  const r3 = await fetch(`http://127.0.0.1:${port}/api/autocomplete?q=shalat`);
  const j3 = await r3.json();
  assert.equal(j3.queries.length, 3);

  // Maintenance mode returns empty
  maintenance = true;
  const r4 = await fetch(`http://127.0.0.1:${port}/api/autocomplete?q=shalat`);
  const j4 = await r4.json();
  assert.deepEqual(j4, { books: [], queries: [] });
});
