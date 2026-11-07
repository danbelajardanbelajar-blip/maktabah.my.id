import test from 'node:test';
import assert from 'node:assert/strict';
import {readQuranPosition,quranLocation,quranHash,saveQuranPosition} from '../src/lib/quran-navigation.ts';
const saved={surah:2,ayah:255,view:'tafsir',book:77,fontSize:32};
test('plain reader resumes the saved position while an explicit ayah link takes precedence',()=>{
  assert.deepEqual(quranLocation('#/quran',saved),saved);
  assert.deepEqual(quranLocation('#/quran?surah=1&ayat=3',saved),{surah:1,ayah:3,view:'ayat',book:undefined,fontSize:32});
  assert.deepEqual(quranLocation(quranHash(saved),saved),saved);
});
test('malformed stored values and URLs cannot create invalid surah/ayah/book or font states',()=>{
  const empty=readQuranPosition({getItem:()=>'{broken'});
  assert.equal(empty.surah,1);assert.equal(empty.ayah,1);assert.equal(empty.fontSize,28);
  const route=quranLocation('#/quran?surah=-2&ayat=9999&book=NaN&view=oops',saved);
  assert.equal(route.surah,1);assert.equal(route.ayah,286);assert.equal(route.book,undefined);assert.equal(route.view,'ayat');
  assert.equal(readQuranPosition({getItem:()=>JSON.stringify({...saved,fontSize:500})}).fontSize,44);
  assert.doesNotThrow(()=>saveQuranPosition({setItem:()=>{throw new Error('full');}},saved));
  assert.deepEqual(readQuranPosition({getItem:()=>JSON.stringify(saved)}),saved);
});
