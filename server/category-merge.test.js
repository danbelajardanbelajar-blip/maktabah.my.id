import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mergeCategories } from './category-merge.js';

function createMockDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE main.categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      catord INTEGER DEFAULT 0,
      lvl INTEGER DEFAULT 0
    );
    CREATE TABLE main.books_meta (
      bkid INTEGER PRIMARY KEY AUTOINCREMENT,
      bk TEXT NOT NULL,
      cat INTEGER,
      authno INTEGER,
      inf TEXT,
      betaka TEXT
    );

    INSERT INTO main.categories (id, name) VALUES (1, 'Kategori Utama 1');
    INSERT INTO main.categories (id, name) VALUES (2, 'Kategori Sumber 2');
    INSERT INTO main.categories (id, name) VALUES (3, 'Kategori Sumber 3');

    INSERT INTO main.books_meta (bkid, bk, cat) VALUES (101, 'Kitab 101', 1);
    INSERT INTO main.books_meta (bkid, bk, cat) VALUES (102, 'Kitab 102', 2);
    INSERT INTO main.books_meta (bkid, bk, cat) VALUES (103, 'Kitab 103', 2);
    INSERT INTO main.books_meta (bkid, bk, cat) VALUES (104, 'Kitab 104', 3);
  `);
  return db;
}

test('mergeCategories moves books and deletes source categories', () => {
  const db = createMockDb();

  const res = mergeCategories(db, {
    sourceCategoryIds: [2, 3],
    targetCategoryId: 1,
    deleteSourceCategories: true
  });

  assert.equal(res.success, true);
  assert.equal(res.booksMoved, 3);
  assert.equal(res.categoriesMerged, 2);
  assert.equal(res.categoriesDeleted, 2);
  assert.equal(res.targetCategoryId, 1);
  assert.equal(res.targetCategoryName, 'Kategori Utama 1');

  // Verify books now belong to category 1
  const booksInCat1 = db.prepare('SELECT bkid FROM main.books_meta WHERE cat = 1').all();
  assert.equal(booksInCat1.length, 4); // 1 original + 2 from cat 2 + 1 from cat 3

  // Verify source categories are deleted
  const remainingCats = db.prepare('SELECT id FROM main.categories').all().map(c => c.id);
  assert.deepEqual(remainingCats, [1]);

  db.close();
});

test('mergeCategories preserves source categories when deleteSourceCategories is false', () => {
  const db = createMockDb();

  const res = mergeCategories(db, {
    sourceCategoryIds: [2],
    targetCategoryId: 1,
    deleteSourceCategories: false
  });

  assert.equal(res.booksMoved, 2);
  assert.equal(res.categoriesDeleted, 0);

  const remainingCats = db.prepare('SELECT id FROM main.categories ORDER BY id ASC').all().map(c => c.id);
  assert.deepEqual(remainingCats, [1, 2, 3]);

  db.close();
});

test('mergeCategories creates new category when newCategoryName is provided', () => {
  const db = createMockDb();

  const res = mergeCategories(db, {
    sourceCategoryIds: [1, 2, 3],
    newCategoryName: 'Kategori Hasil Gabungan'
  });

  assert.equal(res.success, true);
  assert.equal(res.booksMoved, 4);
  assert.equal(res.targetCategoryName, 'Kategori Hasil Gabungan');

  // Verify new category exists and has all 4 books
  const newCat = db.prepare('SELECT id, name FROM main.categories WHERE name = ?').get('Kategori Hasil Gabungan');
  assert.ok(newCat);
  const booksInNewCat = db.prepare('SELECT bkid FROM main.books_meta WHERE cat = ?').all(newCat.id);
  assert.equal(booksInNewCat.length, 4);

  db.close();
});

test('mergeCategories updates books in attached tambahan database', () => {
  const db = createMockDb();
  db.exec(`
    ATTACH DATABASE ':memory:' AS tambahan;
    CREATE TABLE tambahan.books_meta (
      bkid INTEGER PRIMARY KEY,
      bk TEXT,
      cat INTEGER
    );
    INSERT INTO tambahan.books_meta VALUES (201, 'Kitab Tambahan 1', 2);
    INSERT INTO tambahan.books_meta VALUES (202, 'Kitab Tambahan 2', 3);
  `);

  const res = mergeCategories(db, {
    sourceCategoryIds: [2, 3],
    targetCategoryId: 1,
    deleteSourceCategories: true,
    hasTambahan: true
  });

  assert.equal(res.success, true);
  // 3 from main + 2 from tambahan = 5 books moved
  assert.equal(res.booksMoved, 5);

  const tambBooksInCat1 = db.prepare('SELECT bkid FROM tambahan.books_meta WHERE cat = 1').all();
  assert.equal(tambBooksInCat1.length, 2);

  db.close();
});

test('mergeCategories handles target ID inside sourceIds gracefully', () => {
  const db = createMockDb();

  const res = mergeCategories(db, {
    sourceCategoryIds: [1, 2], // 1 is target
    targetCategoryId: 1,
    deleteSourceCategories: true
  });

  assert.equal(res.success, true);
  assert.equal(res.booksMoved, 2); // only cat 2 moved
  assert.equal(res.categoriesMerged, 1);
  assert.equal(res.categoriesDeleted, 1);

  // Target category 1 must NOT be deleted!
  const cat1 = db.prepare('SELECT * FROM main.categories WHERE id = 1').get();
  assert.ok(cat1);

  db.close();
});

test('mergeCategories rejects empty or invalid source IDs', () => {
  const db = createMockDb();

  assert.throws(() => {
    mergeCategories(db, { sourceCategoryIds: [], targetCategoryId: 1 });
  }, /Pilih setidaknya satu/);

  assert.throws(() => {
    mergeCategories(db, { sourceCategoryIds: ['abc'], targetCategoryId: 1 });
  }, /tidak valid/);

  db.close();
});
