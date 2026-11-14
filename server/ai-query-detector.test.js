import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAiQuery, normalizeQueryForDetection } from '../src/lib/ai-query-detector.ts';

test('normalizeQueryForDetection normalizes Arabic diacritics and Alefs', () => {
  const input = 'أَيْنَ الْمَسْجِدُ؟';
  const norm = normalizeQueryForDetection(input);
  assert.equal(norm, 'اين المسجد؟');
});

test('detectAiQuery correctly detects question marks in Latin and Arabic', () => {
  const res1 = detectAiQuery('shalat tahajud?');
  assert.equal(res1.shouldRedirect, true);
  assert.equal(res1.reason, 'question_mark');

  const res2 = detectAiQuery('هل صلاة الوتر واجبة؟');
  assert.equal(res2.shouldRedirect, true);
  assert.equal(res2.reason, 'question_mark');
});

test('detectAiQuery detects Indonesian question words and legal/fiqh intent', () => {
  const queries = [
    { q: 'apa hukum shalat berjamaah', word: 'apa' },
    { q: 'apakah sah wudhu dengan air kopi', word: 'apakah' },
    { q: 'bagaimana cara sujud sahwi', word: 'bagaimana' },
    { q: 'siapa penulis kitab fathul qorib', word: 'siapa' },
    { q: 'mengapa niat shalat harus di awal', word: 'mengapa' },
    { q: 'bolehkah jamak shalat karena hujan', word: 'bolehkah' },
    { q: 'hukum merokok menurut ulama', word: 'hukum' },
    { q: 'jelaskan tata cara mandi wajib', word: 'jelaskan' },
    { q: 'tolong carikan dalil tentang sabar', word: 'tolong' },
    { q: 'dalil puasa ramadhan di al-quran', word: 'dalil' },
    { q: 'pengertian tauhid rububiyyah', word: 'pengertian' },
    { q: 'perbedaan mani madzi dan wadi', word: 'perbedaan' }
  ];

  for (const { q } of queries) {
    const res = detectAiQuery(q);
    assert.equal(res.shouldRedirect, true, `Expected "${q}" to redirect to AI`);
    assert.equal(res.reason, 'question_word');
    assert.ok(res.matchedKeywords.length > 0);
  }
});

test('detectAiQuery detects Arabic question particles and phrases', () => {
  const arabicQueries = [
    'هل يجوز صلاة الوتر ركعة واحدة',
    'ما حكم صلاة الجماعة في المسجد',
    'كيف يتطهر المريض المعذور',
    'أين توفي الإمام الشافعي',
    'لماذا فرضت الصلاة في المعراج',
    'ما معنى التقوى في القرآن',
    'ما الفرق بين الركن والواجب'
  ];

  for (const q of arabicQueries) {
    const res = detectAiQuery(q);
    assert.equal(res.shouldRedirect, true, `Expected Arabic query "${q}" to redirect to AI`);
    assert.equal(res.reason, 'question_word');
  }
});

test('detectAiQuery keeps five-word connector searches and longer searches in normal search', () => {
  const queries = [
    ['shalat sunnah sebelum subuh berjamaah', 5],
    ['shalat sunnah sebelum subuh dan sesudahnya', 6],
    ['panduan tata shalat gerhana matahari sesuai sunnah nabi', 8],
    ['شرح كتاب الصلاة من صحيح البخاري', 6],
  ];
  for (const [query, count] of queries) {
    const result = detectAiQuery(query);
    assert.equal(result.shouldRedirect, false, query);
    assert.equal(result.reason, 'none', query);
    assert.deepEqual(result.matchedKeywords, [], query);
    assert.equal(result.wordCount, count, query);
  }
});

test('detectAiQuery still redirects short and long searches with explicit question triggers', () => {
  for (const query of ['apa', 'hukum', 'dalil', 'hadits', 'jelaskan', 'هل', 'what']) {
    assert.equal(detectAiQuery(query).shouldRedirect, true, query);
    assert.equal(detectAiQuery(query).reason, 'question_word', query);
  }
  for (const mark of ['?', '؟']) {
    const result = detectAiQuery(`panduan tata shalat gerhana matahari sesuai sunnah nabi${mark}`);
    assert.equal(result.shouldRedirect, true);
    assert.equal(result.reason, 'question_mark');
  }
  const result = detectAiQuery('bagaimana panduan shalat gerhana matahari sesuai sunnah nabi');
  assert.equal(result.shouldRedirect, true);
  assert.equal(result.reason, 'question_word');
});

test('detectAiQuery does NOT redirect normal book titles and short classical search keywords', () => {
  const normalSearches = [
    'صحيح البخاري',
    'فتح القريب المجيب',
    'رياض الصالحين',
    'تاريخ الطبري',
    'طهارة',
    'كتاب الصلاة',
    'باب الوضوء',
    'تفسير ابن كثير',
    'fathul qorib',
    'bukhari muslim',
    '',
    '   '
  ];

  for (const q of normalSearches) {
    const res = detectAiQuery(q);
    assert.equal(res.shouldRedirect, false, `Expected normal search "${q}" NOT to redirect`);
    assert.equal(res.reason, 'none');
  }
});
