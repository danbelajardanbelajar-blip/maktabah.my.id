import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {hadithCatalogue,hadithBooks,registerHadithBooks} from './hadith-books.js';
import {parseNavigation,navigationHash} from '../src/lib/navigation.ts';

test('hadith groups contain distinct complete sources with explicit Ithaf ten/eleven membership',()=>{
  const groups=new Map(hadithCatalogue.groups.map(g=>[g.key,g]));
  for(const [key,count] of [['two',2],['four',4],['six',6],['nine',9],['ten',10],['eleven',11]]){
    const g=groups.get(key);assert.equal(g.books.length,count);assert.equal(new Set(g.books).size,count);assert(g.books.every(key=>hadithCatalogue.books.some(b=>b.key===key)));
  }
  assert.deepEqual(groups.get('nine').books,[...groups.get('six').books,'malik','ahmad','darimi']);
  assert(!groups.get('ten').books.includes('bukhari'));assert(groups.get('ten').books.includes('tahawi'));
  assert.deepEqual(groups.get('eleven').books,[...groups.get('ten').books,'daraqutni']);
});

test('hadith links use live title identity, never original MDB IDs, partial titles or conflicting IDs',()=>{
  const result=hadithBooks([{bkid:901,bk:'صحيح البخاري'},{bkid:41,bk:'كتاب مختلف'},{bkid:902,bk:'صحيح البخاري في الميزان'},{bkid:903,bk:'سنن النسائي الكبرى ط- أخرى'},{bkid:904,bk:'سنن النسائي بشرح السيوطي وحاشية السندي'},{bkid:905,bk:'موطأ عبد الله بن وهب'},{bkid:906,bk:'صحيح مسلم'},{bkid:906,bk:'صحيح البخاري'},{bkid:901,bk:'صحيح البخاري'}]);
  assert.deepEqual(result.books.find(b=>b.key==='bukhari').editions,[{id:901,title:'صحيح البخاري'}]);
  assert.equal(result.books.find(b=>b.key==='nasai').editions.length,0);assert.equal(result.books.find(b=>b.key==='malik').editions.length,0);assert.equal(result.books.find(b=>b.key==='muslim').editions.length,0);
  assert.equal(result.books.find(b=>b.key==='ahmad').editions.length,0);
});

test('public hadith endpoint responds to catalogue changes and fails cleanly while offline',async t=>{
  let rows=[{bkid:3,bk:'سنن أبي داود'}];const app=express();registerHadithBooks(app,()=>{if(!rows)throw Error('offline');return rows;});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}/api/hadith-books`;
  assert.equal((await(await fetch(url)).json()).books.find(b=>b.key==='abu-dawud').editions.length,1);
  rows=[];assert.equal((await(await fetch(url)).json()).books.every(b=>b.editions.length===0),true);
  rows=null;assert.equal((await fetch(url)).status,503);
  const route=parseNavigation(navigationHash('hadith',{group:'eleven',q:'مسند'}));assert.equal(route.tab,'hadith');assert.equal(route.params.get('group'),'eleven');assert.equal(route.params.get('q'),'مسند');
});
