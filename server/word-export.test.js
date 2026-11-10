import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBookDocx, isArabicText, ARABIC_FONT, LATIN_FONT } from './word-export.js';

test('isArabicText correctly identifies Arabic and Latin text', () => {
  assert.equal(isArabicText('صحيح البخاري'), true);
  assert.equal(isArabicText('باب بدء الوحي'), true);
  assert.equal(isArabicText('Terjemah Kitab'), false);
  assert.equal(isArabicText('12345'), false);
  assert.equal(isArabicText(''), false);
  assert.equal(isArabicText(null), false);
});

test('generateBookDocx generates valid docx buffer for Arabic book with pages', async () => {
  const buffer = await generateBookDocx({
    title: 'صحيح البخاري',
    author: 'محمد بن إسماعيل البخاري',
    higriYear: '256',
    category: 'الحديث الشريف',
    pages: [
      { juz: 1, page: 1, content: 'إنما الأعمال بالنيات\nوإنما لكل امرئ ما نوى' },
      { juz: 1, page: 2, content: 'فمن كانت هجرته إلى دنيا يصيبها' }
    ]
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 2000);
  // Check ZIP / DOCX magic header: 50 4B 03 04 ("PK\x03\x04")
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4B);
  assert.equal(buffer[2], 0x03);
  assert.equal(buffer[3], 0x04);
});

test('generateBookDocx handles edge cases gracefully (no author, no category, empty pages)', async () => {
  const buffer = await generateBookDocx({
    title: 'Catatan Sederhana',
    pages: []
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4B);
});
