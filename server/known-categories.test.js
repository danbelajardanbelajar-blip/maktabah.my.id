import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { KNOWN_SOURCE_CATEGORIES, resolveCategoryName, buildCategorySqlCase } from './known-categories.js';
import { categoryCatalogueSql } from './book-transfer.js';

test('resolveCategoryName returns official Shamela name for known IDs', () => {
  assert.equal(resolveCategoryName(100), 'تعبير الرؤيا وتفسير الأحلام');
  assert.equal(resolveCategoryName(103), 'الدواوين الشعرية (ملحق)');
  assert.equal(resolveCategoryName(11), 'الخطب والوعظ والآداب');
  assert.equal(resolveCategoryName(46), 'الأجزاء والفوائد الحديثية');
  assert.equal(resolveCategoryName(68), 'أصول الفقه وأدب الفتوى');
  assert.equal(resolveCategoryName(82), 'الجرح والتعديل وعلوم الرواة');
  assert.equal(resolveCategoryName(0), 'كتب عامة غير مصنفة');
});

test('resolveCategoryName falls back to Kategori sumber #ID for unknown IDs', () => {
  assert.equal(resolveCategoryName(999999), 'Kategori sumber #999999');
  assert.equal(resolveCategoryName(null), 'غير مصنف');
});

test('categoryCatalogueSql uses official name when available in known categories', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE main.categories (id INTEGER PRIMARY KEY, name TEXT, catord INTEGER, lvl INTEGER);
    INSERT INTO main.categories VALUES (1, 'العقيدة', 0, 0);

    CREATE TABLE main.books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);

    ATTACH DATABASE ':memory:' AS tambahan;
    CREATE TABLE tambahan.books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);
    INSERT INTO tambahan.books_meta VALUES (1001, 'تعبير الرؤيا', 100, 0, '', '');
    INSERT INTO tambahan.books_meta VALUES (1002, 'كتاب غير معروف التصنيف', 888888, 0, '', '');
  `);

  const cat100 = db.prepare(`SELECT * FROM ${categoryCatalogueSql(true)} WHERE id = 100`).get();
  assert.ok(cat100);
  assert.equal(cat100.name, 'تعبير الرؤيا وتفسير الأحلام');

  const catUnknown = db.prepare(`SELECT * FROM ${categoryCatalogueSql(true)} WHERE id = 888888`).get();
  assert.ok(catUnknown);
  assert.equal(catUnknown.name, 'Kategori sumber #888888');

  db.close();
});
