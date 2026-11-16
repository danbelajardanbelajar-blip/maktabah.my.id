import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ensureSearchPolicySchema,
  syncMetadataExclusions,
  scanUncheckedBooks,
  getExcludedBookIds,
  ensureTempExcludedTable,
  invalidateSearchPolicyCache,
  scanFtsCandidateBooks,
} from './search-policy.js';

function setupFixture(t) {
  const db = new Database(':memory:');
  const stateDb = new Database(':memory:');
  t.after(() => {
    db.close();
    stateDb.close();
    invalidateSearchPolicyCache();
  });

  db.exec(`
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER);
    CREATE TABLE authors (authid INTEGER PRIMARY KEY, auth TEXT);
    CREATE TABLE pages (id INTEGER, book_id INTEGER, part INTEGER, page INTEGER, nass TEXT, PRIMARY KEY (book_id, id));
  `);

  return { db, stateDb };
}

test('search policy syncs title and author exclusions accurately', t => {
  const { db, stateDb } = setupFixture(t);

  db.prepare('INSERT INTO authors VALUES (1, ?), (2, ?)').run('الشافعي', 'ابن تيمية');
  db.prepare('INSERT INTO books_meta VALUES (1, ?, 1, 1), (2, ?, 1, 2), (3, ?, 1, 1), (4, ?, 1, 1)')
    .run('الأم', 'الفتاوى الكبرى', 'كتاب عادي', 'شرح الألباني على الحديث');

  ensureSearchPolicySchema(stateDb);
  const excluded = syncMetadataExclusions(db, stateDb);

  assert.ok(excluded.has(2), 'Author ابن تيمية must be excluded');
  assert.ok(excluded.has(4), 'Title with الألباني must be excluded');
  assert.ok(!excluded.has(1), 'Imam Shafi book must be allowed');
  assert.ok(!excluded.has(3), 'Clean book must be allowed');
});

test('scanUncheckedBooks excludes books with names in body but preserves editor footnotes', t => {
  const { db, stateDb } = setupFixture(t);

  db.prepare('INSERT INTO books_meta VALUES (1, ?, 1, 1), (2, ?, 1, 1), (3, ?, 1, 1)')
    .run('كتاب 1', 'كتاب 2', 'كتاب 3');

  // Book 1: Clean
  db.prepare('INSERT INTO pages VALUES (1, 1, 1, 1, ?)').run('نص عادي بدون ذكر أسماء مستبعدة');
  // Book 2: Mention in body
  db.prepare('INSERT INTO pages VALUES (1, 2, 1, 1, ?)').run('قال ابن عثيمين رحمه الله كذا وكذا');
  // Book 3: Mention only in editor footnote
  db.prepare('INSERT INTO pages VALUES (1, 3, 1, 1, ?)').run('نص المتن الأصلي القديم\n__________\n(1) صححه الألباني');

  ensureSearchPolicySchema(stateDb);
  const scanned = scanUncheckedBooks(db, stateDb, { limit: 10 });
  assert.equal(scanned, 3);

  const excluded = getExcludedBookIds(stateDb);
  assert.ok(excluded.has(2), 'Mention in body must exclude book 2');
  assert.ok(!excluded.has(1), 'Book 1 must remain allowed');
  assert.ok(!excluded.has(3), 'Editor footnote must NOT exclude book 3');
});

test('ensureTempExcludedTable creates and populates temporary table for subqueries', t => {
  const { db } = setupFixture(t);
  ensureTempExcludedTable(db, [10, 20, 30]);

  const rows = db.prepare('SELECT bkid FROM temp.search_excluded_books ORDER BY bkid').all();
  assert.deepEqual(rows.map(r => r.bkid), [10, 20, 30]);

  // Updating replaces old contents
  ensureTempExcludedTable(db, [40]);
  const updated = db.prepare('SELECT bkid FROM temp.search_excluded_books').all();
  assert.deepEqual(updated.map(r => r.bkid), [40]);
});

test('scanFtsCandidateBooks identifies books matching FTS terms and evaluates body', t => {
  const { db, stateDb } = setupFixture(t);
  db.exec(`
    CREATE VIRTUAL TABLE pages_fts USING fts5(nass, content='pages', content_rowid='rowid');
    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, nass) VALUES (new.rowid, new.nass);
    END;
  `);

  db.prepare('INSERT INTO books_meta VALUES (1, ?, 1, 1), (2, ?, 1, 1), (3, ?, 1, 1)').run('كتاب 1', 'كتاب 2', 'كتاب 3');
  db.prepare('INSERT INTO pages (rowid, id, book_id, part, page, nass) VALUES (1, 1, 1, 1, 1, ?)').run('نص عادي بدون أسماء');
  db.prepare('INSERT INTO pages (rowid, id, book_id, part, page, nass) VALUES (2, 2, 2, 1, 1, ?)').run('ذكر ابن تيمية في الفتاوى كذا');
  db.prepare('INSERT INTO pages (rowid, id, book_id, part, page, nass) VALUES (3, 3, 3, 1, 1, ?)').run('متن قديم\n__________\n(1) صححه الألباني');

  ensureSearchPolicySchema(stateDb);
  const found = scanFtsCandidateBooks(db, stateDb);
  assert.equal(found, 2);
  const excluded = getExcludedBookIds(stateDb);
  assert.ok(excluded.has(2), 'Book 2 body match must be excluded');
  assert.ok(!excluded.has(3), 'Book 3 footnote-only must NOT be excluded');
  assert.ok(!excluded.has(1), 'Book 1 must not be excluded');
});

test('title search excludes policy books in basic mode while including in advanced mode', t => {
  const { db, stateDb } = setupFixture(t);
  db.prepare('INSERT INTO authors VALUES (1, ?), (2, ?)').run('الشافعي', 'ابن تيمية');
  db.prepare('INSERT INTO books_meta VALUES (1, ?, 1, 1), (2, ?, 1, 2), (3, ?, 1, 1)').run('شرح الحديث', 'الفتاوى الكبرى', 'الأم');

  ensureSearchPolicySchema(stateDb);
  syncMetadataExclusions(db, stateDb);

  const excludedIds = Array.from(getExcludedBookIds(stateDb));
  assert.deepEqual(excludedIds, [2]);

  // Basic query: filters excluded books
  const basicWhere = 'WHERE b.bk LIKE ? AND b.bkid NOT IN (SELECT value FROM json_each(?))';
  const basicRows = db.prepare(`SELECT b.bkid, b.bk FROM books_meta b ${basicWhere}`).all('%ال%', JSON.stringify(excludedIds));
  assert.deepEqual(basicRows.map(r => r.bkid), [1, 3]);

  // Advanced query: does not filter excluded books
  const advWhere = 'WHERE b.bk LIKE ?';
  const advRows = db.prepare(`SELECT b.bkid, b.bk FROM books_meta b ${advWhere}`).all('%ال%');
  assert.deepEqual(advRows.map(r => r.bkid), [1, 2, 3]);
});
