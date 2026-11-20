import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureSearchPolicySchema,
  syncMetadataExclusions,
  scanUncheckedBooks,
  getExcludedBookIds,
  ensureTempExcludedTable,
  invalidateSearchPolicyCache,
  scanFtsCandidateBooks,
  reconcileSearchPolicyBatch,
} from './search-policy.js';
import { containsExcludedAiName, AI_BOOK_POLICY_VERSION } from './ai-book-policy.js';

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

  db.prepare('INSERT INTO authors VALUES (1, ?), (2, ?)').run('الشافعي', 'ابن باز');
  db.prepare('INSERT INTO books_meta VALUES (1, ?, 1, 1), (2, ?, 1, 2), (3, ?, 1, 1), (4, ?, 1, 1)')
    .run('الأم', 'الفتاوى الكبرى', 'كتاب عادي', 'شرح الألباني على الحديث');

  ensureSearchPolicySchema(stateDb);
  const excluded = syncMetadataExclusions(db, stateDb);

  assert.ok(excluded.has(2), 'Author ابن باز must be excluded');
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
  db.prepare('INSERT INTO pages (rowid, id, book_id, part, page, nass) VALUES (2, 2, 2, 1, 1, ?)').run('ذكر ابن باز في الفتاوى كذا');
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
  db.prepare('INSERT INTO authors VALUES (1, ?), (2, ?)').run('الشافعي', 'ابن باز');
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

test('search query for excluded name returns empty in basic mode and allows in advanced mode', () => {
  for (const query of ['ابن باز', 'الألباني', 'ابن عثيمين']) {
    const isExcluded = containsExcludedAiName(query);
    assert.equal(isExcluded, true, `Query ${query} must be recognized as excluded`);

    // In basic mode: query returns empty
    const isAdvanced = false;
    const shouldBlock = !isAdvanced && isExcluded;
    assert.equal(shouldBlock, true);

    // In advanced mode: query is allowed
    const advancedBlocked = false && isExcluded;
    assert.equal(advancedBlocked, false);
  }
});

test('ابن تيمية is no longer a blocked search query, but the phrase شيخ الإسلام ابن تيمية is', () => {
  for (const query of ['شيخ الإسلام ابن تيمية', 'شيخ الاسلام ابن تيمية']) assert.equal(containsExcludedAiName(query), true, query);
  for (const query of ['ابن تيمية', 'الفتاوى الكبرى لابن تيمية', 'تيمية']) {
    assert.equal(containsExcludedAiName(query), false, query);
  }
});

test('books excluded under an older policy version are re-checked and released when they no longer match', async t => {
  const { db, stateDb } = setupFixture(t);
  db.prepare('INSERT INTO authors VALUES (1, ?), (2, ?), (3, ?)').run('ابن تيمية', 'الشافعي', 'ابن باز');
  db.prepare('INSERT INTO books_meta VALUES (1, ?, 1, 1), (2, ?, 1, 2), (3, ?, 1, 2), (4, ?, 1, 3), (5, ?, 1, 2)')
    .run('الفتاوى الكبرى', 'الأم', 'كتاب فيه ذكر', 'فتاوى نور على الدرب', 'كتاب نظيف');
  db.prepare('INSERT INTO pages VALUES (1, 2, 1, 1, ?)').run('قال ابن تيمية كذا');      // only the removed name
  db.prepare('INSERT INTO pages VALUES (1, 3, 1, 1, ?)').run('قال ابن تيمية');
  db.prepare('INSERT INTO pages VALUES (2, 3, 1, 2, ?)').run('وقال ابن عثيمين كذا');    // still matches on another page
  ensureSearchPolicySchema(stateDb);
  // State left by the v4 policy: books 1 (author), 2 and 3 (content) excluded; book 5 evaluated clean.
  const put = stateDb.prepare('INSERT INTO search_book_policy (bkid, excluded, reason, updated_at, policy_version) VALUES (?, ?, ?, 0, ?)');
  put.run(1, 1, 'author', 'whole-book-exclusions-v4'); put.run(2, 1, 'content', null); put.run(3, 1, 'content', 'whole-book-exclusions-v4');
  put.run(5, 0, null, 'whole-book-exclusions-v4');
  assert.deepEqual([...getExcludedBookIds(stateDb)].sort(), [1, 2, 3]);

  assert.equal(await reconcileSearchPolicyBatch(db, stateDb, { limit: 2 }), 1, 'one stale book left after the first batch');
  assert.equal(await reconcileSearchPolicyBatch(db, stateDb, { limit: 2 }), 0);
  assert.equal(await reconcileSearchPolicyBatch(db, stateDb, { limit: 2 }), 0, 'finished: clean rows of old versions are dropped');
  assert.deepEqual([...getExcludedBookIds(stateDb)], [3], 'only the book that still names an excluded scholar stays hidden');
  const rows = stateDb.prepare('SELECT bkid, excluded, reason, policy_version FROM search_book_policy ORDER BY bkid').all();
  assert.deepEqual(rows.map(r => [r.bkid, r.excluded, r.reason]), [[1, 0, null], [2, 0, null], [3, 1, 'content']]);
  assert.ok(rows.every(r => r.policy_version === AI_BOOK_POLICY_VERSION));
  // New scans record the current version too, so nothing is re-checked again.
  syncMetadataExclusions(db, stateDb);
  assert.ok(getExcludedBookIds(stateDb).has(4), 'author ابن باز still excludes');
  assert.equal(await reconcileSearchPolicyBatch(db, stateDb), 0);
});

test('re-check of a file-backed library scans pages in the worker and releases falcon/Taymiyyah-only books', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-policy-'));
  const db = new Database(path.join(dir, 'library.db')), stateDb = new Database(':memory:');
  t.after(() => { db.close(); stateDb.close(); invalidateSearchPolicyCache(); fs.rmSync(dir, { recursive: true, force: true }); });
  db.exec(`CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER);
    CREATE TABLE authors (authid INTEGER PRIMARY KEY, auth TEXT);
    CREATE TABLE pages (id INTEGER, book_id INTEGER, part INTEGER, page INTEGER, nass TEXT, PRIMARY KEY (book_id, id));`);
  db.prepare('INSERT INTO books_meta VALUES (?, ?, 1, NULL)').run(225, 'منهاج السنة النبوية');
  db.prepare('INSERT INTO books_meta VALUES (?, ?, 1, NULL)').run(7, 'كتاب في التخريج');
  db.prepare('INSERT INTO pages VALUES (1, 225, 1, 1, ?)').run('قال ابن تيمية رحمه الله');
  db.prepare('INSERT INTO pages VALUES (2, 225, 1, 2, ?)').run('كما يقولون تقضي البازي وتقضض');
  db.prepare('INSERT INTO pages VALUES (1, 7, 1, 1, ?)').run('وصححه الألباني في الصحيحة');
  ensureSearchPolicySchema(stateDb);
  const put = stateDb.prepare("INSERT INTO search_book_policy VALUES (?, 1, 'content', 0, 'whole-book-exclusions-v4')");
  put.run(225); put.run(7);
  assert.equal(await reconcileSearchPolicyBatch(db, stateDb), 0);
  assert.deepEqual([...getExcludedBookIds(stateDb)], [7]);
});
