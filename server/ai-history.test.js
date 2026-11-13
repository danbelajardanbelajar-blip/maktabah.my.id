import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import {registerAiHistory} from './ai-history.js';

test('two browsers on the same IP have isolated history; legacy rows remain admin-only',async t=>{
  const db=new Database(':memory:');db.exec("CREATE TABLE ask_logs(question TEXT,response TEXT,ip TEXT,user_agent TEXT); INSERT INTO ask_logs VALUES('Pertanyaan lama bersama','Jawaban','127.0.0.1','test')");
  const app=express();app.set('trust proxy',true);app.use(express.json());const history=registerAiHistory(app,{getStateDb:()=>db});
  app.get('/session',(req,res)=>{history.session(req,res,true);res.json({ok:true});});
  app.post('/record',(req,res)=>{history.session(req,res,true);history.record(req,res,req.body.q,'Jawaban');res.json({ok:true});});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();});const base=`http://127.0.0.1:${server.address().port}`;
  const a=await fetch(base+'/session'),b=await fetch(base+'/session');
  const cookieA=a.headers.get('set-cookie').split(';')[0],cookieB=b.headers.get('set-cookie').split(';')[0];
  assert.notEqual(cookieA,cookieB);assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
  for(const [cookie,q] of [[cookieA,'Pertanyaan browser A'],[cookieB,'Pertanyaan browser B']])await fetch(base+'/record',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({q})});
  const read=async cookie=>(await (await fetch(base+'/api/recent-questions',{headers:cookie?{cookie}:{}})).json()).data;
  assert.deepEqual(await read(cookieA),[{query:'Pertanyaan browser A'}]);assert.deepEqual(await read(cookieB),[{query:'Pertanyaan browser B'}]);assert.deepEqual(await read(),[]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM ask_logs').get().n,3);
  assert.ok(!JSON.stringify(db.prepare('SELECT session_id FROM ask_logs').all()).includes(cookieA.split('=')[1]));
  const secure=await fetch(base+'/session',{headers:{'X-Forwarded-Proto':'https'}});assert.match(secure.headers.get('set-cookie'),/; Secure/);
});

test('admin audit metadata stores mode, cited sources and quotes for later answer checks',async t=>{
  const db=new Database(':memory:');db.exec('CREATE TABLE ask_logs(question TEXT,response TEXT,ip TEXT,user_agent TEXT)');
  const app=express();app.use(express.json());const history=registerAiHistory(app,{getStateDb:()=>db});
  app.post('/record',(req,res)=>{history.record(req,res,'Hukum wudhu?','Jawaban [1]',{},req.body.payload);res.json({ok:true});});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();});const base=`http://127.0.0.1:${server.address().port}`;
  const payload={mode:'grounded',reviewed:true,references:[{bkid:7,pageId:12,title:'Kitab A',juz:1,page:3,excerpt:'x'.repeat(2000)}],evidence:{quotes:[{source:1,text:'kutipan'}]}};
  await fetch(base+'/record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})});
  await fetch(base+'/record',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const rows=db.prepare('SELECT meta_json FROM ask_logs ORDER BY rowid').all();
  const meta=JSON.parse(rows[0].meta_json);
  assert.equal(meta.mode,'grounded');assert.equal(meta.reviewed,true);
  assert.deepEqual({...meta.references[0],excerpt:undefined},{bkid:7,pageId:12,title:'Kitab A',juz:1,page:3,excerpt:undefined});
  assert.ok(meta.references[0].excerpt.length<=1201);assert.deepEqual(meta.quotes,[{source:1,text:'kutipan'}]);
  assert.equal(rows[1].meta_json,null);
});
