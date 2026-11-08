import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {verifiedReferences,verifyAnswer,evidenceAnswer,validCachedAnswer} from './ai-evidence.js';
test('evidence resolves canonical book/page, restores Arabic marks and rejects forged quotes/citations/cache',()=>{
 const db=new Database(':memory:');try{
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);");
 db.prepare('INSERT INTO books_meta VALUES(1,?)').run('أصل');
 db.prepare('INSERT INTO pages VALUES(11,1,2,17,?)').run('صَلَاةُ الجماعة واجبة عند بعض الفقهاء');
 const refs=verifiedReferences(db,[{bkid:1,pageId:11,title:'fake',excerpt:'صلاة الجماعة واجبة عند بعض الفقهاء'}]);
 assert.equal(refs[0].title,'أصل');assert.equal(refs[0].page,17);
 const evidence=verifyAnswer({answer:'Penjelasan [1]',quotes:[{source:1,text:'صلاة الجماعة واجبة'}]},refs);
 assert.equal(evidence.quotes[0].text,'صَلَاةُ الجماعة واجبة');
 for(const bad of [
  {answer:'Penjelasan [9]',quotes:evidence.quotes},
  {answer:'Penjelasan [1]',quotes:[{source:1,text:'kutipan palsu yang tidak ada'}]},
  {answer:'Penjelasan [1]',quotes:[]},
  {answer:'Penjelasan “kutipan palsu yang tidak ada” [1]',quotes:evidence.quotes},
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
