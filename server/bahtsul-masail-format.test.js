import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBahtsulMasailLine } from './bahtsul-masail-format.js';
import { generateBookHtmlPdf } from './pdf-export.js';
import { generateBookDocx } from './word-export.js';

test('classifyBahtsulMasailLine detects Question and Answer sections and resets on Editor/Kontributor', () => {
  let section = null;

  let res = classifyBahtsulMasailLine('Pendahuluan umum', section);
  section = res.section;
  assert.equal(section, null);

  res = classifyBahtsulMasailLine('Pertanyaan', section);
  section = res.section;
  assert.equal(section, 'question');
  assert.equal(res.isHeading, true);

  res = classifyBahtsulMasailLine('Bagaimana hukum shalat Jumat?', section);
  section = res.section;
  assert.equal(section, 'question');
  assert.equal(res.isHeading, false);

  res = classifyBahtsulMasailLine('Jawaban', section);
  section = res.section;
  assert.equal(section, 'answer');
  assert.equal(res.isHeading, true);

  res = classifyBahtsulMasailLine('Waalaikumussalam wr. wb.', section);
  section = res.section;
  assert.equal(section, 'answer');

  res = classifyBahtsulMasailLine('Editor: Amien Nurhakim', section);
  section = res.section;
  assert.equal(section, null);
});

test('classifyBahtsulMasailLine handles inline prefixes and Arabic markers', () => {
  assert.deepEqual(classifyBahtsulMasailLine('Soal: Apakah wajib?', null), { section: 'question', isHeading: false });
  assert.deepEqual(classifyBahtsulMasailLine('الجواب: نعم، يجب.', 'question'), { section: 'answer', isHeading: false });
  assert.deepEqual(classifyBahtsulMasailLine('السؤال', null), { section: 'question', isHeading: true });
});

test('PDF and Word exports apply distinct question and answer styling without breaking output', async () => {
  const samplePages = [{ juz: 1, page: 1, content: 'Pertanyaan\nBagaimana hukumnya?\nJawaban\nHukumnya boleh.' }];
  const pdfHtml = generateBookHtmlPdf({ title: 'Bahtsul Masail', pages: samplePages });
  assert.ok(pdfHtml.includes('bm-question'));
  assert.ok(pdfHtml.includes('bm-answer'));

  const docxBuffer = await generateBookDocx({ title: 'Bahtsul Masail', pages: samplePages });
  assert.ok(Buffer.isBuffer(docxBuffer) && docxBuffer.length > 100);
});
