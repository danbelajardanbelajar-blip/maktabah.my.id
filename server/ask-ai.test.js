import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { readAiConfig, generateGemini, retrieveAiReferences, registerAskAi } from './ask-ai.js';

const key = 'AIza' + 'a'.repeat(35);
const response = text => new Response(JSON.stringify({ candidates:[{content:{parts:[{text}]}}] }),{status:200});
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'maktabah-ai-'));
  const configPath=path.join(dir,'ai-config.local.json');
  fs.writeFileSync(configPath,JSON.stringify({apiKey:key,model:'gemini-flash-latest'}));
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE books_meta(bkid INTEGER PRIMARY KEY,bk TEXT);CREATE TABLE pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT);
    CREATE VIRTUAL TABLE pages_fts USING fts5(nass,content='pages');
    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN INSERT INTO pages_fts(rowid,nass) VALUES(new.rowid,new.nass);END;
    CREATE TABLE ask_logs(question TEXT,response TEXT,ip TEXT,user_agent TEXT);`);
  db.prepare('INSERT INTO books_meta VALUES(1,?)').run('كتاب الفقه');
  db.prepare('INSERT INTO pages VALUES(11,1,2,17,?)').run('صلاة الجماعة واجبة عند بعض الفقهاء وهي سنة عند غيرهم');
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
  return {db,configPath,cache:new Map()};
}
async function serve(t,f,fetchImpl,extras={}) {
  const app=express();app.use(express.json());
  registerAskAi(app,{getDb:()=>f.db,getStateDb:()=>f.db,hasAdditional:()=>false,cache:f.cache,configPath:f.configPath,localExportMode:false,fetchImpl,env:{},
    requireAdmin:(req,res,next)=>req.headers.authorization==='Bearer test'?next():res.sendStatus(401),...extras});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(r=>server.close(r)));
  return async (route,body,admin=false,cookie) => {
    const r=await fetch(`http://127.0.0.1:${server.address().port}${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer test'}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json().catch(()=>null);return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
}

test('configuration ignores placeholder keys and never needs a committed secret', t=>{
  const f=fixture(t);
  fs.unlinkSync(f.configPath);
  assert.equal(readAiConfig(f.configPath,{GEMINI_API_KEY:'YOUR_API_KEY'}).keys.length,0);
  assert.deepEqual(readAiConfig(f.configPath,{GEMINI_API_KEY:key}).keys,[key]);
});

test('availability follows maintenance and recovers without exposing configuration secrets',async t=>{
  const f=fixture(t);let maintenance=true,calls=0;
  const request=await serve(t,f,async()=>{calls++;return response('unused');},{isMaintenance:()=>maintenance});
  const busy=await request('/api/ai/status');
  assert.equal(busy.data.available,false);assert.equal(busy.data.reason,'maintenance');assert.ok(!JSON.stringify(busy.data).includes(key));
  assert.equal((await request('/api/ask',{q:'صلاة الجماعة'})).status,409);assert.equal(calls,0);
  maintenance=false;assert.equal((await request('/api/ai/status')).data.available,true);
});

test('cached answers are recorded in the requesting browser history without sharing other questions',async t=>{
  const f=fixture(t),call=await serve(t,f,async()=>response('Jawaban [1]'));
  const a=(await call('/api/ai/status')).cookie,b=(await call('/api/ai/status')).cookie;
  await call('/api/ask',{q:'صلاة الجماعة'},false,a);
  await call('/api/ask',{q:'صلاة الجماعة'},false,b);
  assert.deepEqual((await call('/api/recent-questions',undefined,false,a)).data.data,[{query:'صلاة الجماعة'}]);
  assert.deepEqual((await call('/api/recent-questions',undefined,false,b)).data.data,[{query:'صلاة الجماعة'}]);
  assert.equal(f.db.prepare('SELECT count(DISTINCT session_id) AS n FROM ask_logs').get().n,2);
});

test('Gemini uses header authentication and falls back only when a model is unavailable', async()=>{
  const seen=[];
  const result=await generateGemini({keys:[key],model:'gemini-not-found'},'test',{fetchImpl:async(url,options)=>{
    seen.push(url);assert.equal(options.headers['x-goog-api-key'],key);assert.ok(!url.includes(key));
    assert.ok(!JSON.parse(options.body).generationConfig.thinkingConfig);
    return seen.length===1?new Response('{}',{status:404}):response('OK');
  }});
  assert.equal(result.text,'OK');assert.equal(result.model,'gemini-flash-latest');assert.equal(seen.length,2);
});

test('quota, rejected keys and deadlines produce actionable messages without provider secrets', async()=>{
  for(const [status,code] of [[429,'QUOTA'],[403,'CONFIGURATION'],[500,'PROVIDER_UNAVAILABLE']]) {
    await assert.rejects(generateGemini({keys:[key],model:'gemini-flash-latest'},'test',{fetchImpl:async()=>new Response(JSON.stringify({error:{message:key}}),{status})}),e=>e.code===code&&!e.message.includes(key));
  }
  await assert.rejects(generateGemini({keys:[key],model:'gemini-flash-latest'},'test',{fetchImpl:async()=>{throw new DOMException('timeout','TimeoutError');}}),e=>e.code==='TIMEOUT');
});

test('retrieval returns real Arabic pages and optional catalogue entries, including attached sources', t=>{
  const f=fixture(t);
  const refs=retrieveAiReferences(f.db,'ما حكم صلاة الجماعة');
  assert.equal(refs[0].bkid,1);assert.equal(refs[0].pageId,11);assert.equal(refs[0].page,17);assert.ok(refs[0].excerpt.includes('الجماعة'));
  f.db.exec("ATTACH DATABASE ':memory:' AS tambahan; CREATE TABLE tambahan.books_meta(bkid INTEGER,bk TEXT); CREATE TABLE tambahan.pages(id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,nass TEXT); CREATE VIRTUAL TABLE tambahan.pages_fts USING fts5(nass,content='pages');");
  f.db.prepare('INSERT INTO tambahan.books_meta VALUES(2,?)').run('كتاب الصلاة');
  f.db.prepare('INSERT INTO tambahan.pages VALUES(21,2,1,3,?)').run('صلاة الجماعة في المسجد');
  f.db.exec("INSERT INTO tambahan.pages_fts(pages_fts) VALUES('rebuild')");
  assert.ok(retrieveAiReferences(f.db,'صلاة الجماعة',true).some(r=>r.bkid===2&&r.pageId===21));
  assert.ok(retrieveAiReferences(f.db,'هل كتاب الفقه موجود',false,true).some(r=>r.bkid===1&&r.pageId===null));
});

test('Indonesian question translates to Arabic, answers from real excerpts and caches the response', async t=>{
  const f=fixture(t);let calls=0;
  const call=await serve(t,f,async(url,options)=>{
    calls++;const body=JSON.parse(options.body);
    if(calls===1)return response('صلاة الجماعة');
    assert.ok(body.contents[0].parts[0].text.includes('صلاة الجماعة'));
    assert.ok(body.contents[0].parts[0].text.includes('halaman 17'));
    return response('Teks menjelaskan perbedaan pendapat mengenai salat berjamaah [1].');
  });
  const q={q:'Apa hukum salat berjamaah?'};
  const first=await call('/api/ask',q);assert.equal(first.data.status,'success');assert.equal(first.data.references[0].pageId,11);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ask_logs').get().n,1);
  assert.equal((await call('/api/ask',q)).data.answer,first.data.answer);assert.equal(calls,2);
});

test('missing evidence returns an honest no-context result without asking the model to invent an answer', async t=>{
  const f=fixture(t);
  const call=await serve(t,f,async()=>{throw new Error('Must not call model');});
  const result=await call('/api/ask',{q:'الموضوعغيرالموجودفيالكتاب'});
  assert.equal(result.data.mode,'no_context');assert.deepEqual(result.data.references,[]);
});

test('admin tests and saves keys privately; invalid provider configuration cannot replace a working key', async t=>{
  const f=fixture(t);let bad=false;
  const call=await serve(t,f,async()=>bad?new Response('{}',{status:403}):response('OK'));
  assert.equal((await call('/api/admin/ai-settings')).status,401);
  assert.equal((await call('/api/admin/ai-settings',{},false)).status,401);
  const saved=await call('/api/admin/ai-settings',{apiKey:key,model:'gemini-flash-latest'},true);
  assert.equal(saved.data.success,true);assert.ok(!JSON.stringify(saved.data).includes(key));
  assert.ok(!JSON.stringify((await call('/api/admin/ai-settings',undefined,true)).data).includes(key));
  assert.equal((await call('/api/ai/status')).data.available,true);
  if(process.platform!=='win32')assert.equal(fs.statSync(f.configPath).mode&0o777,0o600);
  const before=fs.readFileSync(f.configPath,'utf8');bad=true;
  assert.equal((await call('/api/admin/ai-settings',{apiKey:'AIza'+'b'.repeat(35)},true)).status,503);
  assert.equal(fs.readFileSync(f.configPath,'utf8'),before);
});

test('input validation, absent configuration, quota errors and local mode are handled', async t=>{
  const f=fixture(t);
  const call=await serve(t,f,async()=>new Response('{}',{status:429}),{localExportMode:true});
  for(const q of [{},'abc','x'.repeat(1501)])assert.equal((await call('/api/ask',{q})).status,400);
  assert.equal((await call('/api/admin/ai-settings',{apiKey:key},true)).status,403);
  const quota=await call('/api/ask',{q:'صلاة الجماعة'});assert.equal(quota.data.code,'QUOTA');
  fs.unlinkSync(f.configPath);
  assert.equal((await call('/api/ai/status')).data.available,false);
  assert.equal((await call('/api/ask',{q:'صلاة الجماعة'})).status,503);
});

test('selected page is loaded from database, contextual history/cache stay separate and forged selections fail',async t=>{
 const f=fixture(t);let prompts=[];
 const call=await serve(t,f,async(url,o)=>{prompts.push(JSON.parse(o.body).contents[0].parts[0].text);return response('Penjelasan [1]');});
 const cookie=(await call('/api/ai/status')).cookie;
 const body={q:'Jelaskan halaman ini',intent:'explain',source:{bookId:1,pageId:11,title:'FORGED',text:'صلاة الجماعة'}};
 const first=await call('/api/ask',body,false,cookie);assert.equal(first.data.source.title,'كتاب الفقه');assert.equal(first.data.references[0].excerpt,'صلاة الجماعة');assert.ok(!prompts[0].includes('FORGED'));
 await call('/api/ask',body,false,cookie);assert.equal(prompts.length,1);
 await call('/api/ask',{...body,intent:'translate'},false,cookie);assert.equal(prompts.length,2);
 const history=(await call('/api/recent-questions',undefined,false,cookie)).data.data;assert.equal(history.length,2);assert.equal(history[0].intent,'translate');assert.equal(history[0].source.pageId,11);
 assert.equal((await call('/api/ask',{...body,source:{bookId:2,pageId:11}})).status,404);
 assert.equal((await call('/api/ask',{...body,source:{bookId:1,pageId:11,text:'teks palsu'}})).status,400);
 assert.equal(prompts.length,2);
});
