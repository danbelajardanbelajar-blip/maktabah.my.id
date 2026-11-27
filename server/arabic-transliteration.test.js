import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  arabicWordToSkeleton,
  latinWordToSkeleton,
  buildBookTranslitIndex,
  matchTranslitBooks,
} from './arabic-transliteration.js';

test('arabicWordToSkeleton and latinWordToSkeleton converge on common book terms', () => {
  assert.equal(arabicWordToSkeleton('صحيح'), latinWordToSkeleton('shahih'));
  assert.equal(arabicWordToSkeleton('البخاري'), latinWordToSkeleton('bukhari'));
  assert.equal(arabicWordToSkeleton('فتح'), latinWordToSkeleton('fathul'));
  assert.equal(arabicWordToSkeleton('الباري'), latinWordToSkeleton('bari'));
  assert.equal(arabicWordToSkeleton('بلوغ'), latinWordToSkeleton('bulughul'));
  assert.equal(arabicWordToSkeleton('المرام'), latinWordToSkeleton('maram'));
});

test('matchTranslitBooks finds Arabic books from Latin transliteration and aliases while respecting exclusions', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());

  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER);
    INSERT INTO categories VALUES (1, 'Fikih'), (2, 'Hadis'), (3, 'Tafsir'), (4, 'Nahwu');
    INSERT INTO books_meta VALUES
      (1, 'صحيح البخاري', 2),
      (2, 'فتح الباري شرح صحيح البخاري', 2),
      (3, 'رياض الصالحين', 2),
      (4, 'بلوغ المرام', 2),
      (5, 'إحياء علوم الدين', 1),
      (6, 'تفسير الجلالين', 3),
      (7, 'الآجرومية', 4),
      (8, 'الأربعون النووية', 2),
      (99, 'كتاب محظور بالبخاري', 1);
  `);

  const index = buildBookTranslitIndex(db);
  const excluded = new Set([99]);

  const bukhari = matchTranslitBooks(index, 'shahih bukhari', { excluded });
  assert.ok(bukhari.length >= 1);
  assert.equal(bukhari[0].title, 'صحيح البخاري');
  assert.ok(!bukhari.some((b) => b.bkid === 99));

  const fathul = matchTranslitBooks(index, 'fathul bari', { excluded });
  assert.equal(fathul[0].title, 'فتح الباري شرح صحيح البخاري');

  const riyadh = matchTranslitBooks(index, 'riyadhus shalihin', { excluded });
  assert.equal(riyadh[0].title, 'رياض الصالحين');

  const ihya = matchTranslitBooks(index, 'ihya ulumuddin', { excluded });
  assert.equal(ihya[0].title, 'إحياء علوم الدين');

  const jalalain = matchTranslitBooks(index, 'tafsir jalalain', { excluded });
  assert.equal(jalalain[0].title, 'تفسير الجلالين');

  const jurumiyah = matchTranslitBooks(index, 'jurumiyah', { excluded });
  assert.equal(jurumiyah[0].title, 'الآجرومية');

  const arbain = matchTranslitBooks(index, 'arbain nawawi', { excluded });
  assert.equal(arbain[0].title, 'الأربعون النووية');

  // Too short or unrelated should not match
  assert.deepEqual(matchTranslitBooks(index, 'ab', { excluded }), []);
  assert.deepEqual(matchTranslitBooks(index, 'zzzzxxxx', { excluded }), []);
});
