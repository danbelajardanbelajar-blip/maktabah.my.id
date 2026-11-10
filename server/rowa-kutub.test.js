import test from 'node:test';
import assert from 'node:assert/strict';
import { extractKutubList, extractKutubString } from './rowa-kutub.js';

test('extractKutubList extracts famous hadith compilers from telmez', () => {
  const sample1 = 'B # # أبو داود ( حديثا واحدا ) # إبراهيم بن عبد الله بن الجنيد الختلى';
  assert.deepEqual(extractKutubList(sample1), ['سنن أبي داود']);

  const sample2 = 'C : روى عنه : # # مسلم # أبو داود # الترمذى # ابن ماجة # أبو العباس';
  const list2 = extractKutubList(sample2);
  assert.ok(list2.includes('صحيح مسلم'));
  assert.ok(list2.includes('سنن أبي داود'));
  assert.ok(list2.includes('جامع الترمذي'));
  assert.ok(list2.includes('سنن ابن ماجه'));

  const sample3 = 'B # # النسائى فى حديث مالك # أحمد بن سليمان';
  const list3 = extractKutubList(sample3);
  assert.ok(list3.includes('سنن النسائي'));
  assert.ok(list3.includes('موطأ مالك'));
});

test('extractKutubString formats books as hash-separated string', () => {
  const sample = 'B # # النسائى # ابن ماجة';
  const str = extractKutubString(sample);
  assert.ok(str.includes('سنن النسائي'));
  assert.ok(str.includes('سنن ابن ماجه'));
  assert.ok(str.includes(' # '));
});

test('extractKutubList handles empty, null, or unknown telmez gracefully', () => {
  assert.deepEqual(extractKutubList(''), []);
  assert.deepEqual(extractKutubList(null), []);
  assert.deepEqual(extractKutubList(undefined), []);
  assert.deepEqual(extractKutubList('زيد بن علي # جعفر بن محمد'), []);
  assert.equal(extractKutubString(''), '');
});
