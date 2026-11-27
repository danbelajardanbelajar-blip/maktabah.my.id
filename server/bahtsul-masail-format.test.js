import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBahtsulMasailLine } from './bahtsul-masail-format.js';
import { generateBookHtmlPdf } from './pdf-export.js';
import { generateBookDocx } from './word-export.js';

test('classifyBahtsulMasailLine detects Question, Answer, Arabic reference quotes, Referensi block, and resets on Editor', () => {
  let section = null;

  let res = classifyBahtsulMasailLine('Pendahuluan umum', section);
  section = res.section;
  assert.equal(section, null);
  assert.equal(res.isReference, false);

  res = classifyBahtsulMasailLine('Pertanyaan', section);
  section = res.section;
  assert.equal(section, 'question');
  assert.equal(res.isHeading, true);

  res = classifyBahtsulMasailLine('Bagaimana hukum shalat Jumat?', section);
  section = res.section;
  assert.equal(section, 'question');
  assert.equal(res.isReference, false);

  res = classifyBahtsulMasailLine('Jawaban', section);
  section = res.section;
  assert.equal(section, 'answer');
  assert.equal(res.isHeading, true);

  // Arabic ibarat quote inside Answer -> isReference = true, keeps section = 'answer'
  res = classifyBahtsulMasailLine('يُشْتَرَطُ أَنْ يَكُونَ الْبِنَاءُ مَمْلُوكًا', section);
  section = res.section;
  assert.equal(section, 'answer');
  assert.equal(res.isReference, true);

  // Subsequent Indonesian translation resumes normal Answer style
  res = classifyBahtsulMasailLine('Artinya: Disyaratkan bangunan tersebut milik sendiri.', section);
  section = res.section;
  assert.equal(section, 'answer');
  assert.equal(res.isReference, false);

  // Referensi section
  res = classifyBahtsulMasailLine('Referensi:', section);
  section = res.section;
  assert.equal(section, 'reference');
  assert.equal(res.isHeading, true);
  assert.equal(res.isReference, true);

  res = classifyBahtsulMasailLine('1. Hasyiyah al-Bujairimi, jilid 2, hlm. 150.', section);
  section = res.section;
  assert.equal(section, 'reference');
  assert.equal(res.isReference, true);

  res = classifyBahtsulMasailLine('Editor: Amien Nurhakim', section);
  section = res.section;
  assert.equal(section, null);
  assert.equal(res.isReference, false);
});

test('classifyBahtsulMasailLine handles inline prefixes and Arabic markers', () => {
  assert.deepEqual(classifyBahtsulMasailLine('Soal: Apakah wajib?', null), { section: 'question', isHeading: false, isReference: false });
  assert.deepEqual(classifyBahtsulMasailLine('الجواب: نعم، يجب.', 'question'), { section: 'answer', isHeading: false, isReference: false });
  assert.deepEqual(classifyBahtsulMasailLine('السؤال', null), { section: 'question', isHeading: true, isReference: false });
});

test('PDF and Word exports apply distinct question, answer, and WhatsApp-style reference styling', async () => {
  const samplePages = [{
    juz: 1,
    page: 1,
    content: 'Pertanyaan\nBagaimana hukumnya?\nJawaban\nيُشْتَرَطُ أَنْ يَكُونَ مَمْلُوكًا\nArtinya boleh.\nReferensi:\n1. Kitab Fikih, hlm. 10.',
  }];
  const pdfHtml = generateBookHtmlPdf({ title: 'Bahtsul Masail', pages: samplePages });
  assert.ok(pdfHtml.includes('bm-question'));
  assert.ok(pdfHtml.includes('bm-answer'));
  assert.ok(pdfHtml.includes('bm-reference'));

  const docxBuffer = await generateBookDocx({ title: 'Bahtsul Masail', pages: samplePages });
  assert.ok(Buffer.isBuffer(docxBuffer) && docxBuffer.length > 100);
});
