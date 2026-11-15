import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {quoteCatalog,quoteUnits,verifiedReferences,verifyAnswer,evidenceAnswer,validCachedAnswer} from './ai-evidence.js';
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

test('quotes are whole sentences across wrapped lines and display as one paragraph in reading direction',()=>{
 const db=new Database(':memory:');try{
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);INSERT INTO books_meta VALUES(1,'Book');");
 const id='Ada orang yang menggunakan uang pinjaman untuk membeli saham. Transaksi ini hukumnya\nharam, karena hakikatnya adalah kredit yang\nditambah laba. Ini hukumnya mubah karena\ntermasuk bai\' Murabahah .';
 const ar='انتهى مجمع الفقه الإسلامى الى القول بجواز انشاء شركات المساهمة حيث ورد مانصه: " بما أن الأصل فى\nالمعاملات الحل فإن تأسيس شركة مساهمة ذات أغراض وأنشطة مشروعة أمر جائز".';
 db.prepare('INSERT INTO pages VALUES(1,1,1,1,?)').run(id);db.prepare('INSERT INTO pages VALUES(2,1,1,2,?)').run(ar);
 const refs=verifiedReferences(db,[{bkid:1,pageId:1,excerpt:id},{bkid:1,pageId:2,excerpt:ar}]);
 const catalog=quoteCatalog(refs),texts=[...catalog.values()].map(q=>q.text.replace(/\s+/g,' '));
 assert.ok(texts.some(t=>t.startsWith('Transaksi ini hukumnya haram, karena hakikatnya adalah kredit yang ditambah laba.')),texts.join(' | '));
 assert.ok(!texts.some(t=>t==='untuk membeli saham. Transaksi ini hukumnya'));
 assert.ok(texts.every(t=>/[.!?؟"]$/.test(t)),'every unit ends at a sentence boundary');
 const [first]=[...catalog].find(([,q])=>q.source===2);
 const answer=evidenceAnswer(verifyAnswer({answer:'Penjelasan [2]',quotes:[{source:2,quoteId:first}]},refs,catalog));
 assert.ok(answer.endsWith('جائز".» [2]'),answer);assert.ok(answer.includes('«انتهى'));assert.ok(!answer.split('**Kutipan sumber**')[1].trim().includes('\n'));
 assert.ok(quoteUnits('a'.repeat(1500)).every(u=>u.length<=600));
 }finally{db.close();}
});

test('quote units start at a letter and quote IDs in prose become source numbers',()=>{
 assert.ok(quoteUnits('هل يجب عليه أن يصلى مع الجماعة الصلاة التي قد صلاها، أم لا؟: أما المسألة الاولى: فإن العلماء اختلفوا فيها، فذهب الجمهور إلى أنها سنة.').every(u=>/^[\p{L}«"“(]/u.test(u)));
 const db=new Database(':memory:');try{
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);INSERT INTO books_meta VALUES(1,'Book');");
 db.prepare('INSERT INTO pages VALUES(1,1,1,1,?)').run('صلاة الجماعة واجبة عند بعض الفقهاء وهي سنة عند غيرهم من أهل العلم.');
 const refs=verifiedReferences(db,[{bkid:1,pageId:1,excerpt:'صلاة الجماعة واجبة عند بعض الفقهاء وهي سنة عند غيرهم من أهل العلم.'}]);
 const result=verifyAnswer({answer:'Ulama berbeda pendapat [1.1]. [1]',quotes:[{source:1,quoteId:'1.1'}]},refs,quoteCatalog(refs));
 assert.equal(result.answer,'Ulama berbeda pendapat [1].');
 }finally{db.close();}
});

test('grouped quote IDs in prose become separate source citations that survive renumbering',()=>{
 const db=new Database(':memory:');try{
 db.exec("CREATE TABLE books_meta(bkid INTEGER,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);INSERT INTO books_meta VALUES(1,'Book');");
 const a='Saham perusahaan yang usahanya mubah boleh diperjualbelikan menurut para ulama.',b='Pembelian saham dengan kredit berbunga hukumnya haram karena termasuk riba.';
 db.prepare('INSERT INTO pages VALUES(1,1,1,1,?)').run(a);db.prepare('INSERT INTO pages VALUES(2,1,1,2,?)').run(b);
 const refs=verifiedReferences(db,[{bkid:1,pageId:1,excerpt:a},{bkid:1,pageId:2,excerpt:b}]);
 const result=verifyAnswer({answer:'Boleh [1.1, 2.1] tetapi kredit haram [2.1، 2.1].',quotes:[{source:1,quoteId:'1.1'},{source:2,quoteId:'2.1'}]},refs,quoteCatalog(refs));
 assert.equal(result.answer,'Boleh [1][2] tetapi kredit haram [2].');
 }finally{db.close();}
});

test('a quote never spans the footnote rule between page text and its notes',()=>{
 const units=quoteUnits('حيث علم الناس عامة وأهل العراق ثم مصر خاصة معنى الاحتجاج بالسنة __________ (1) بضم السين منسوب الى بنى سليم بالتصغير قبيلة من غيلان.');
 assert.ok(units.length>=2);assert.ok(units.every(u=>!u.includes('_')));assert.ok(units[0].endsWith('بالسنة'));assert.ok(units[1].startsWith('(1) بضم السين')||units[1].startsWith('بضم السين'));
});
