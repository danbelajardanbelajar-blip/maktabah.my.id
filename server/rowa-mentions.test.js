import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import Database from 'better-sqlite3';
import {createRowaNames,normalizeRowaName,registerRowaMentions} from './rowa-mentions.js';
const rows=[{id:1,Name:'يحيى بن سعيد بن قيس الأنصاري'},{id:2,Name:'يحيى بن سعيد بن فروخ القطان'},{id:3,Name:'عمر بن الخطاب بن نفيل القرشي'},{id:4,Name:'عبد الرحمن بن صخر الدوسي ، أبو هريرة'},{id:5,Name:'أحمد بن محمد ، أخو يحيى بن سعيد'},{id:6,Name:'عبد الرحمن بن فلان ، أبو هريرة'}];
test('mentions preserve Arabic offsets, prefer longest names, and expose ambiguity without choosing a person',()=>{
  const index=createRowaNames(rows),text='حَدَّثَنَا يَحْيَى بْنُ سَعِيدٍ، عَنْ عُمَرَ بْنِ الْخَطَّابِ، عَنْ أَبِي هُرَيْرَةَ';
  const mentions=index.mentions(text);assert.equal(mentions.length,3);for(const m of mentions)assert.equal(text.slice(m.start,m.end),m.label);
  assert.equal(mentions[0].count,2);assert.equal(mentions[1].count,1);assert.equal(mentions[2].count,2);
  assert.deepEqual(index.candidates('يحيى بن سعيد').data.map(p=>p.id).sort(),[1,2]);
  assert(!index.candidates('يحيى بن سعيد').data.some(p=>p.id===5));
  assert.equal(index.mentions('يحيى بن سعيد بن فروخ القطان')[0].count,1);
  assert.equal(index.mentions('عمر. بن الخطاب').length,0);assert.equal(index.mentions('يحيى').length,0);
  assert.equal(normalizeRowaName('أَبِي هُرَيْرَةَ'),'ابو هريرة');assert.equal(normalizeRowaName('عمر ابن الخطاب'),'عمر بن الخطاب');
});
test('candidate pagination and full-name fallbacks do not fabricate profiles or book relations',()=>{
  const index=createRowaNames(Array.from({length:45},(_,i)=>({id:i+1,IsoName:` محمد بن سعيد بن رقم ${i} `})));
  assert.equal(index.candidates('محمد بن سعيد').total,45);assert.equal(index.candidates('محمد بن سعيد',3).data.length,5);
  assert.equal(index.candidates('لايوجد في البيانات').total,0);assert.throws(()=>index.candidates('عمر',0),/ال|Halaman/);
  assert(!('kutub' in index.candidates('محمد بن سعيد').data[0]));
});
test('HTTP matching is bounded, read-only and refreshes after activating another narrator database',async t=>{
  const make=name=>{const db=new Database(':memory:');db.exec('CREATE TABLE rowa(id INTEGER,Name TEXT)');db.prepare('INSERT INTO rowa VALUES(?,?)').run(1,name);return db;};
  const first=make('عمر بن الخطاب'),second=make('أنس بن مالك');let active=first;const app=express();app.use(express.json());registerRowaMentions(app,()=>active);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();first.close();second.close();});
  const base=`http://127.0.0.1:${server.address().port}`,post=texts=>fetch(base+'/api/rowa/mentions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts})});
  const r=await post(['عن عمر بن الخطاب']);assert.equal(r.status,200);assert.equal((await r.json()).data[0].length,1);
  assert.equal((await post(['x'.repeat(60001)])).status,400);assert.equal((await post([{}])).status,400);
  active=second;assert.equal((await(await post(['عن عمر بن الخطاب'])).json()).data[0].length,0);
  assert.equal((await(await fetch(base+'/api/rowa/name-candidates?q='+encodeURIComponent('أنس بن مالك'))).json()).data[0].id,1);
  assert.equal(first.prepare('SELECT count(*) n FROM rowa').get().n,1);
});
