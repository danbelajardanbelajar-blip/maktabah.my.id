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

test('detectAiQuery detects long conversational sentences (word count >= 6 or 5 with connectors)', () => {
  const sentence1 = 'panduan tata shalat gerhana matahari sesuai sunnah nabi';
  const res1 = detectAiQuery(sentence1);
  assert.equal(res1.shouldRedirect, true);
  assert.equal(res1.reason, 'long_sentence');

  const sentence2 = 'shalat sunnah sebelum subuh dan sesudahnya';
  const res2 = detectAiQuery(sentence2);
  assert.equal(res2.shouldRedirect, true);
  assert.equal(res2.reason, 'long_sentence');
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
