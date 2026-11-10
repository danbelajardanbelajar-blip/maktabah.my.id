import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBookHtmlPdf } from './pdf-export.js';

test('generateBookHtmlPdf produces valid print-ready HTML with exact Arabic styling', () => {
  const html = generateBookHtmlPdf({
    title: 'صحيح البخاري',
    author: 'محمد بن إسماعيل البخاري',
    higriYear: '256',
    category: 'الحديث الشريف',
    pages: [
      { juz: 1, page: 1, content: 'إنما الأعمال بالنيات\nوإنما لكل امرئ ما نوى' },
      { juz: 1, page: 2, content: 'فمن كانت هجرته إلى دنيا يصيبها' }
    ]
  });

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('صحيح البخاري'));
  assert.ok(html.includes('تأليف: محمد بن إسماعيل البخاري (ت: 256 هـ)'));
  assert.ok(html.includes('التصنيف: الحديث الشريف'));
  assert.ok(html.includes('line-arabic'));
  assert.ok(html.includes('page-break'));
  assert.ok(html.includes('window.print()'));
});

test('generateBookHtmlPdf handles missing author and category without error', () => {
  const html = generateBookHtmlPdf({
    title: 'Kitab Tanpa Penulis',
    pages: []
  });

  assert.ok(html.includes('Kitab Tanpa Penulis'));
  assert.ok(!html.includes('class="book-author"'));
  assert.ok(html.includes('class="book-divider"'));
});
