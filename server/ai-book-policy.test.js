import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {containsExcludedAiName,filterAllowedAiReferences,invalidateAiBookPolicy,assertAllowedAiBook} from './ai-book-policy.js';

function fixture(t, filename=':memory:') {
  const db=new Database(filename);
  db.exec('CREATE TABLE pages(id INTEGER,book_id INTEGER,nass TEXT); CREATE INDEX pages_book ON pages(book_id);');
  const put=db.prepare('INSERT INTO pages VALUES(?,?,?)');
  put.run(1,1,'نص مباح في الصفحة المختارة');put.run(2,1,'ذكر ابن تيمية في صفحة أخرى');
  put.run(1,2,'كتاب آخر بلا أسماء مستبعدة');
  t.after(()=>db.close());return db;
}

test('all four names match despite harakat, tatweel, HTML entities, line breaks, alif, ta marbuta and proclitic variants',()=>{
  for(const text of [
    'ابن تيمية','بن تيمية','قال شيخ الإسلام بن تيمية','ابن تيميه','إبن تيمية','لابن تيمية','وابن تيمية','إِبْن تَيْمِيَّة','ابـن\nتيمية','<p>ابن&nbsp;تيمية</p>','ابن &#1578;يمية','ابنتيمية','دورةبن تيمية',
    'ابن باز','قال بن باز','عبد العزيز بن باز','وابن باز','فتاوى ابن باز:','الدرر البازية','الفتاوى البازية',
    'عُثَيْمِين','العثيمين','ابن عثيمين','محمد بن صالح العثيمين','لابن عثيمين',
    'الألباني','الالباني','الألبانى','للألباني','والألباني','صححه الألباني.','محمد ناصر الدين الألباني','الأَلْبَانِيّ','التخريجات الألبانية',
  ])assert.equal(containsExcludedAiName(text),true,text);
  // محمد بن عبد الوهاب is no longer excluded: it is also the name of hadith narrators in the isnads of Muslim and the Sunan.
  for(const text of ['حدثنا محمد بن عبد الوهاب الفراء','محمد بن عبد الوهاب','محمد بن عبد الله','ابن كثير','ابن تيماء','صلاة الجماعة','عبد الوهاب الشعراني','تاج الدين عبد الوهاب السبكي','الباني لهذا المسجد','ابن بازل','بنباء'])assert.equal(containsExcludedAiName(text),false,text);
});

test('a mention on any other page excludes every reference and catalogue entry of that book only',async t=>{
  const db=fixture(t);
  const refs=[{bkid:1,pageId:1},{bkid:1,pageId:null},{bkid:2,pageId:1}];
  assert.deepEqual(await filterAllowedAiReferences(db,refs),[refs[2]]);
  await assert.rejects(assertAllowedAiBook(db,refs[0]),e=>e.code==='AI_SOURCE_EXCLUDED'&&e.status===403);
});

test('same book ID in either attached source is excluded and other books remain eligible',async t=>{
  const db=fixture(t);
  db.exec("ATTACH DATABASE ':memory:' AS tambahan;CREATE TABLE tambahan.pages(id INTEGER,book_id INTEGER,nass TEXT); INSERT INTO tambahan.pages VALUES(8,2,'ابن تيمية'),(9,3,'نص آخر');");
  assert.deepEqual(await filterAllowedAiReferences(db,[{bkid:1},{bkid:2},{bkid:3}],true),[{bkid:3}]);
});

test('application invalidation detects inserting, editing, removing or moving a mention',async t=>{
  const db=fixture(t);
  assert.equal((await filterAllowedAiReferences(db,[{bkid:2}])).length,1);
  db.prepare('INSERT INTO pages VALUES(?,?,?)').run(2,2,'بن باز');invalidateAiBookPolicy(db);
  assert.equal((await filterAllowedAiReferences(db,[{bkid:2}])).length,0);
  db.prepare('UPDATE pages SET nass=? WHERE book_id=2 AND id=2').run('نص آخر');invalidateAiBookPolicy(db);
  assert.equal((await filterAllowedAiReferences(db,[{bkid:2}])).length,1);
  db.exec('UPDATE pages SET book_id=2 WHERE book_id=1 AND id=2');invalidateAiBookPolicy(db);
  assert.deepEqual(await filterAllowedAiReferences(db,[{bkid:1},{bkid:2}]),[{bkid:1}]);
  db.exec('DELETE FROM pages WHERE book_id=2 AND id=2');invalidateAiBookPolicy(db);
  assert.equal((await filterAllowedAiReferences(db,[{bkid:2}])).length,1);
});

test('file-backed scanning is read-only and detects edits by an external connection',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-policy-')),filename=path.join(dir,'source.db');
  const db=fixture(t,filename);
  const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');const before=hash();
  assert.deepEqual(await filterAllowedAiReferences(db,[{bkid:1},{bkid:2}]),[{bkid:2}]);
  assert.equal(hash(),before);
  const other=new Database(filename);other.exec("INSERT INTO pages VALUES(3,2,'عثيمين')");other.close();
  assert.deepEqual(await filterAllowedAiReferences(db,[{bkid:2}]),[]);
  const extra=path.join(dir,'extra.db'),attached=new Database(extra);
  attached.exec("CREATE TABLE pages(id INTEGER,book_id INTEGER,nass TEXT);INSERT INTO pages VALUES(1,3,'نص متاح'),(2,4,'قال ابن تيمية');");attached.close();
  db.prepare('ATTACH DATABASE ? AS tambahan').run(extra);
  const extraHash=crypto.createHash('sha256').update(fs.readFileSync(extra)).digest('hex');
  assert.deepEqual(await filterAllowedAiReferences(db,[{bkid:3},{bkid:4}],true),[{bkid:3}]);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(extra)).digest('hex'),extraHash);
  // Keep this temporary fixture for OS cleanup if a worker is still releasing its read-only handle.
});

test('source changes during a worker scan and cancellation fail closed',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-policy-race-'));const db=fixture(t,path.join(dir,'source.db'));
  const pending=filterAllowedAiReferences(db,[{bkid:2}]);invalidateAiBookPolicy(db);
  await assert.rejects(pending,e=>e.code==='AI_SOURCE_CHANGED');
  const controller=new AbortController();controller.abort();
  await assert.rejects(filterAllowedAiReferences(db,[{bkid:2}],false,{signal:controller.signal}),e=>e.code==='CANCELLED');
  const during=new AbortController();const scanning=filterAllowedAiReferences(db,[{bkid:2}],false,{signal:during.signal});during.abort();
  await assert.rejects(scanning,e=>e.code==='CANCELLED');
});

test('missing page storage cannot approve a book for use as evidence',async t=>{
  const db=new Database(':memory:');t.after(()=>db.close());
  await assert.rejects(filterAllowedAiReferences(db,[{bkid:1}]));
});

test('a name only in an editor footnote does not exclude the book, but an excerpt quoting it is never used',async t=>{
  const db=fixture(t);const put=db.prepare('INSERT INTO pages VALUES(?,?,?)');
  put.run(1,3,'وقيل: من علم عبدا آية من كتاب الله فهو له عبد.\n__________\n(¬2) علق شيخ الإسلام ابن تيمية عليه بأنه موضوع.');
  put.run(2,3,'الكذب يورث الفقر وكثرة النوم تورث الفقر.');
  put.run(1,4,'قال ابن تيمية في متن الكتاب كذا.\n__________\n(1) حاشية عادية.');
  const body={bkid:3,pageId:2,excerpt:'الكذب يورث الفقر'},footnote={bkid:3,pageId:1,excerpt:'فهو له عبد. (¬2) علق شيخ الإسلام ابن تيمية عليه بأنه موضوع.'},main={bkid:4,pageId:1,excerpt:'حاشية عادية'};
  assert.deepEqual(await filterAllowedAiReferences(db,[body,footnote,main]),[body]);
});
