import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {quoteCatalog,verifiedReferences,verifyAnswer,evidenceAnswer,validCachedAnswer} from './ai-evidence.js';
test('evidence resolves canonical book/page, restores Arabic marks and rejects forged quotes/citations/cache',()=>{
 const db=new Database(':memory:');try{
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);");
 db.prepare('INSERT INTO books_meta VALUES(1,?)').run('أصل');
 db.prepare('INSERT INTO pages VALUES(11,1,2,17,?)').run('صَلَاةُ الجماعة واجبة عند بعض الفقهاء');
 const refs=verifiedReferences(db,[{bkid:1,pageId:11,title:'fake',excerpt:'صلاة الجماعة واجبة عند بعض الفقهاء'}]);
 assert.equal(refs[0].title,'أصل');assert.equal(refs[0].page,17);
 const evidence=verifyAnswer({answer:'Penjelasan [1]',quotes:[{source:1,text:'صلاة الجماعة واجبة'}]},refs);
 assert.ok(verifyAnswer({answer:'Penjelasan tanpa nomor',quotes:evidence.quotes},refs).answer.endsWith('[1]'));
 const catalog=quoteCatalog(refs);
 assert.equal(verifyAnswer({answer:'Transliterasi "salat al jamaah" [1]',quotes:[{source:1,quoteId:'1.1'}]},refs,catalog).quotes[0].text,'صَلَاةُ الجماعة واجبة عند بعض الفقهاء');
 assert.throws(()=>verifyAnswer({answer:'Fake [1]',quotes:[{source:1,quoteId:'99.1'}]},refs,catalog));
 assert.throws(()=>verifyAnswer({answer:'Fake [1]',quotes:[{source:2,quoteId:'1.1'}]},refs,catalog));
 assert.equal(evidence.quotes[0].text,'صَلَاةُ الجماعة واجبة');
 for(const bad of [
  {answer:'Penjelasan [9]',quotes:evidence.quotes},
  {answer:'Penjelasan [1]',quotes:[{source:1,text:'kutipan palsu yang tidak ada'}]},
  {answer:'Penjelasan [1]',quotes:[]},
  {answer:'Penjelasan [1]',quotes:[{source:0,text:'صلاة الجماعة واجبة'}]},
 ])assert.throws(()=>verifyAnswer(bad,refs),e=>e.code==='UNVERIFIED_ANSWER');
 assert.throws(()=>verifiedReferences(db,[{...refs[0],bkid:2}]));
 const payload={mode:'grounded',answer:evidenceAnswer(evidence),evidence,references:refs};
 assert.equal(validCachedAnswer(db,payload),true);
 db.prepare('UPDATE pages SET nass=?').run('teks telah berubah');assert.equal(validCachedAnswer(db,payload),false);
 db.exec('DELETE FROM pages');assert.equal(validCachedAnswer(db,payload),false);
 assert.equal(validCachedAnswer(db,{mode:'no_context'}),false);
 }finally{db.close();}
});

test('joined line breaks restore exact original quote; synthetic FTS ellipses cannot become a direct quote',()=>{
 const db=new Database(':memory:');try{
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);INSERT INTO books_meta VALUES(1,'Book');");
 db.prepare('INSERT INTO pages VALUES(1,1,1,1,?)').run('بغية المسترشدين (ص: 132)\nفما يجمعه الناس ويبذلونه لعمارتها');
 const refs=verifiedReferences(db,[{bkid:1,pageId:1,excerpt:'بغية المسترشدين (ص: 132)\nفما يجمعه الناس ويبذلونه لعمارتها'}]);
 const result=verifyAnswer({answer:'Penjelasan [1]',quotes:[{source:1,text:'المسترشدين (ص: 132)فما يجمعه الناس'}]},refs);
 assert.equal(result.quotes[0].text,'المسترشدين (ص: 132)\nفما يجمعه الناس');
 const snippets=verifiedReferences(db,[{bkid:1,pageId:1,excerpt:'بغية المسترشدين … الناس ويبذلونه'}]);
 assert.throws(()=>verifyAnswer({answer:'Penjelasan [1]',quotes:[{source:1,text:'بغية المسترشدين … الناس ويبذلونه'}]},snippets));
 }finally{db.close();}
});
