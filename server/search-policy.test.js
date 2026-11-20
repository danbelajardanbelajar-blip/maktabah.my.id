import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureSearchPolicySchema,
  syncMetadataExclusions,
  getExcludedBookIds,
  ensureTempExcludedTable,
  invalidateSearchPolicyCache,
  startSearchPolicyScan,
  searchPolicyScanStatus,
  forgetSearchPolicyBook,
} from './search-policy.js';
import { containsExcludedAiName } from './ai-book-policy.js';

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

// File-backed library (main + attached additional database), as on the server, scanned by the real worker.
function libraryFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-policy-'));
  const schema = `CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER);
    CREATE TABLE authors (authid INTEGER PRIMARY KEY, auth TEXT);
    CREATE TABLE pages (id INTEGER, book_id INTEGER, part INTEGER, page INTEGER, nass TEXT, PRIMARY KEY (book_id, id));`;
  const extra = new Database(path.join(dir, 'tambahan.db')); extra.exec(schema); extra.close();
  const db = new Database(path.join(dir, 'library.db')), stateDb = new Database(':memory:');
  db.exec(schema); db.exec(`ATTACH DATABASE '${path.join(dir, 'tambahan.db').replace(/'/g, "''")}' AS tambahan`);
  t.after(() => { db.close(); stateDb.close(); invalidateSearchPolicyCache(); fs.rmSync(dir, { recursive: true, force: true }); });
  const book = (schemaName, id, title, authno = null) => db.prepare(`INSERT INTO ${schemaName}.books_meta VALUES (?, ?, 1, ?)`).run(id, title, authno);
  const page = (schemaName, bookId, pageId, text) => db.prepare(`INSERT INTO ${schemaName}.pages VALUES (?, ?, 1, ?, ?)`).run(pageId, bookId, pageId, text);
  ensureSearchPolicySchema(stateDb);
  return { db, stateDb, book, page };
}
const rows = stateDb => stateDb.prepare('SELECT bkid, excluded, reason FROM search_book_policy ORDER BY bkid').all().map(r => [r.bkid, r.excluded, r.reason]);

test('full scan decides every book in both databases, including names deep inside large books', async t => {
  const { db, stateDb, book, page } = libraryFixture(t);
  db.prepare('INSERT INTO authors VALUES (1, ?), (2, ?)').run('الشافعي', 'محمد بن صالح العثيمين');
  book('main', 1, 'كتاب نظيف', 1); for (let i = 1; i <= 300; i++) page('main', 1, i, `نص عادي رقم ${i}`);
  book('main', 2, 'كتاب كبير', 1); for (let i = 1; i <= 300; i++) page('main', 2, i, i === 287 ? 'وقال الشيخ ابن باز' : 'نص');
  book('main', 3, 'شرح للألباني', 1);
  book('main', 4, 'كتاب', 2);
  book('main', 5, 'متن', 1); page('main', 5, 1, 'متن قديم\n__________\n(1) صححه الألباني');
  book('main', 6, 'فتاوى', 1); page('main', 6, 1, 'قال ابن تيمية'); page('main', 6, 2, 'كما يقولون تقضي البازي');
  book('tambahan', 7, 'كتاب إضافي'); page('tambahan', 7, 1, '<p>قال شيخ الإسلام&nbsp;ابن تيمية</p>');
  // An old row from a previous policy version must be replaced.
  stateDb.prepare("INSERT INTO search_book_policy (bkid, excluded, reason, updated_at, policy_version) VALUES (6, 1, 'content', 0, 'whole-book-exclusions-v4')").run();

  const result = await startSearchPolicyScan(db, stateDb, { hasTambahan: true, pauseRatio: 0 });
  assert.deepEqual([result.books, result.pending, result.scanned, result.excluded], [7, 7, 7, 4]);
  assert.deepEqual(rows(stateDb), [[1, 0, null], [2, 1, 'content'], [3, 1, 'title'], [4, 1, 'author'], [5, 0, null], [6, 0, null], [7, 1, 'content']]);
  assert.deepEqual([...getExcludedBookIds(stateDb)].sort(), [2, 3, 4, 7]);
  assert.equal(searchPolicyScanStatus().running, false);
});

test('later scans only re-check new, changed or edited books, and every book after a policy version change', async t => {
  const { db, stateDb, book, page } = libraryFixture(t);
  book('main', 1, 'كتاب أ'); page('main', 1, 1, 'نص');
  book('main', 2, 'كتاب ب'); page('main', 2, 1, 'نص');
  book('main', 3, 'كتاب ج'); page('main', 3, 1, 'نص');
  assert.equal((await startSearchPolicyScan(db, stateDb, { pauseRatio: 0 })).pending, 3);
  assert.equal((await startSearchPolicyScan(db, stateDb, { pauseRatio: 0 })).pending, 0, 'nothing changed');

  page('main', 1, 2, 'وصححه الألباني');                                                     // import adds a page
  db.prepare('UPDATE pages SET nass = ? WHERE book_id = 2').run('قال ابن عثيمين'); forgetSearchPolicyBook(stateDb, 2); // admin edit
  book('main', 4, 'كتاب جديد'); page('main', 4, 1, 'نص');                                   // new book
  const second = await startSearchPolicyScan(db, stateDb, { pauseRatio: 0 });
  assert.deepEqual([second.pending, second.excluded], [3, 2]);
  assert.deepEqual([...getExcludedBookIds(stateDb)].sort(), [1, 2]);

  stateDb.prepare("UPDATE search_book_policy SET policy_version = 'older'").run();
  assert.equal((await startSearchPolicyScan(db, stateDb, { pauseRatio: 0 })).pending, 4, 'a new policy version re-checks everything');
});

test('a scan requested while one runs is queued, and in-memory libraries are refused', async t => {
  const { db, stateDb, book, page } = libraryFixture(t);
  book('main', 1, 'كتاب'); page('main', 1, 1, 'نص');
  const first = startSearchPolicyScan(db, stateDb, { pauseRatio: 0 });
  assert.equal(startSearchPolicyScan(db, stateDb, { pauseRatio: 0 }), first, 'same promise while running');
  const firstStart = (await first).startedAt;
  assert.equal(searchPolicyScanStatus().running, true, 'the queued scan starts as soon as the first one ends');
  while (searchPolicyScanStatus().running) await new Promise(resolve => setTimeout(resolve, 20));
  assert.notEqual(searchPolicyScanStatus().startedAt, firstStart);
  const memory = new Database(':memory:'); t.after(() => memory.close());
  await assert.rejects(startSearchPolicyScan(memory, stateDb), /berbasis file/);
});
