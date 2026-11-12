import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeWho,withRowaSources} from './rowa-codes.js';
test('Bukhari source symbols produce Tirmidhi and Nasai without using student names',()=>{
  const result=withRowaSources({WHO:' ت س ',telmez:'أحمد بن سهل بن مالك # حاشد بن إسماعيل البخاري # مسلم بن الحجاج (في غير الصحيح)'});
  assert.deepEqual(result.books.map(b=>b.code),['ت','س']);
  assert.doesNotMatch(result.kutub,/موطأ|البخاري|مسلم/);
  assert.equal(withRowaSources({telmez:'مالك # البخاري # مسلم'}).kutub,'');
});
test('symbols are whole tokens and distinguish other works from canonical collections',()=>{
  assert.deepEqual(decodeWho('بخ مق فق').books.map(b=>b.label),['الأدب المفرد للبخاري','مقدمة صحيح مسلم','تفسير ابن ماجه']);
  assert.deepEqual(decodeWho('كد كن').books.map(b=>b.label),['مسند مالك لأبي داود','مسند مالك للنسائي']);
  assert.equal(decodeWho('تمييز').books.length,0);assert.equal(decodeWho('تمييز').distinctionOnly,true);
  assert.deepEqual(decodeWho('??? ت').unknown,['???']);
  assert.equal(decodeWho('ع 4 ٤ خ').books.length,6);
  assert.deepEqual(decodeWho('ى سى').books.map(b=>b.code),['ي','سي']);
  assert.equal(decodeWho('خ م د ت س ق ( روايته فى مقدمة مسلم )').books.length,0);
  assert.equal(decodeWho('د س ق ( لم يصح أنهم رووا له )').books.length,0);
});
