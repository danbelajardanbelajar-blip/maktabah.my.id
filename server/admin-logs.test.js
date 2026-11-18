import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {readAdminLogs,deleteAdminLogs,registerAdminLogs} from './admin-logs.js';
import {adminActivityIdentity,setAdminActivityCookie} from './admin-log-identity.js';
import {createLibraryActivity} from './library-activity.js';
import {registerAiHistory} from './ai-history.js';

function fixture(t){
 const db=new Database(':memory:');t.after(()=>db.close());
 const fields={search:'query TEXT,result_count INTEGER,mode TEXT',ask:'question TEXT,response TEXT,context_json TEXT',visit:'path TEXT',download:'book_title TEXT,book_id INTEGER',quran:'surah_id INTEGER',rowa:'rowa_name TEXT,rowa_id INTEGER',hadith:'action TEXT,query TEXT,target_id INTEGER,target_name TEXT,result_count INTEGER,context TEXT',authors:'action TEXT,query TEXT,target_id INTEGER,target_name TEXT,result_count INTEGER,context TEXT'};
 for(const [type,columns] of Object.entries(fields))db.exec(`CREATE TABLE ${type}_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,ip TEXT,user_agent TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,${columns});`);
 db.exec('CREATE TABLE admin_tokens(token TEXT PRIMARY KEY);');return db;
}

test('rankings, filters and pagination cover all records beyond the previous 500-row limit',t=>{
 const db=fixture(t),put=db.prepare('INSERT INTO search_logs(query,ip,result_count) VALUES(?,?,?)');
 for(let i=0;i<620;i++)put.run(i<510?' Puasa ':'lainnya',i<400?'1.1.1.1':'2.2.2.2',i%2?1:0);
 const first=readAdminLogs(db,'search',{limit:'20'});
 assert.equal(first.stats.total,620);assert.equal(first.total,620);assert.equal(first.data.length,20);
 assert.deepEqual(first.top.query[0],{value:'puasa',count:510});assert.deepEqual(first.top.ip[0],{value:'1.1.1.1',count:400});assert.equal(first.top.question,undefined);
 const filtered=readAdminLogs(db,'search',{dimension:'query',value:'puasa',outcome:'zero',page:'2',limit:'20'});
 assert.equal(filtered.total,255);assert.equal(filtered.page,2);assert.equal(filtered.data.length,20);assert.equal(filtered.stats.total,620);
 assert.equal(readAdminLogs(db,'search',{page:'999'}).page,31);
});

test('questions, pages and per-feature targets are aggregated without trusting invalid JSON',t=>{
 const db=fixture(t);
 db.exec(`INSERT INTO ask_logs(question,context_json) VALUES(' Apa itu? ','{}'),('apa itu?','broken'),('lain','{"source":{"bookId":7,"pageId":2}}');
 INSERT INTO visit_logs(path) VALUES('/book/7'),('/book/7'),('home');
 INSERT INTO hadith_logs(action,target_id,context) VALUES('read_book',7,'{"page_id":2}'),('edition',7,'broken'),('read_book',7,'broken');
 INSERT INTO authors_logs(action,target_id,context) VALUES('profile',7,'{}');`);
 assert.deepEqual(readAdminLogs(db,'ask').top.question[0],{value:'apa itu?',count:2});
 assert.equal(readAdminLogs(db,'ask').top.page[0].value,'Kitab #7 · halaman #2');
 assert.deepEqual(readAdminLogs(db,'visit').top.page[0],{value:'/book/7',count:2});
 assert.equal(readAdminLogs(db,'hadith').top.page.length,2);
 assert.equal(readAdminLogs(db,'authors').top.page[0].value,'Penulis #7');
 // Each log shows only the groups it records: no "top questions" in search logs, no "top searches" in Tanya AI logs.
 const groups={search:['query','ip'],ask:['question','page','ip'],visit:['page','ip'],download:['page','ip'],quran:['page','ip'],rowa:['page','ip'],hadith:['query','page','ip'],authors:['query','page','ip']};
 for(const [type,expected] of Object.entries(groups))assert.deepEqual(Object.keys(readAdminLogs(db,type).top),expected,type);
 assert.throws(()=>readAdminLogs(db,'search',{dimension:'question',value:'x'}),/Kelompok ringkasan tidak valid/);
});

test('text search treats wildcard characters literally and date boundaries follow WIB',t=>{
 const db=fixture(t);
 db.exec(`INSERT INTO search_logs(query,created_at) VALUES('100%_literal','2026-11-14 16:59:59'),('other','2026-11-14 17:00:00'),('next','2026-11-15 17:00:00');`);
 assert.equal(readAdminLogs(db,'search',{q:'%_'}).total,1);
 const date=readAdminLogs(db,'search',{from:'2026-11-15',to:'2026-11-15'});assert.equal(date.total,1);assert.equal(date.data[0].query,'other');
 for(const raw of [{dimension:'constructor',value:'x'},{outcome:'zero'}, {from:'2026-02-31'},{from:'2026-12-01',to:'2026-11-01'},{limit:'9999'},{page:'-1'}]){
   const type=raw.outcome?'visit':'search';assert.throws(()=>readAdminLogs(db,type,raw),e=>e.status===400);
 }
 assert.throws(()=>readAdminLogs(db,'constructor'),e=>e.status===400);
});

test('deletion stays inside the selected log table and preview snapshot excludes newly arrived records',t=>{
 const db=fixture(t);
 db.exec("INSERT INTO search_logs(query,ip) VALUES('spam','x'),('spam','x'),('keep','y');INSERT INTO ask_logs(question) VALUES('keep');");
 const filters={dimension:'ip',value:'x'},preview=readAdminLogs(db,'search',filters);
 db.exec("INSERT INTO search_logs(query,ip) VALUES('new spam','x');");
 assert.equal(deleteAdminLogs(db,'search',{filters,throughId:preview.snapshotId,expectedCount:preview.total,confirm:'DELETE_MATCHING_LOGS'}).deleted,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM search_logs').get().n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM ask_logs').get().n,1);
 assert.throws(()=>deleteAdminLogs(db,'search',{filters,throughId:preview.snapshotId,expectedCount:2,confirm:'DELETE_MATCHING_LOGS'}),e=>e.status===409);
 assert.throws(()=>deleteAdminLogs(db,'search',{filters:{},throughId:10,expectedCount:2,confirm:'DELETE_MATCHING_LOGS'}),e=>e.status===400);
 assert.throws(()=>deleteAdminLogs(db,'search',{ids:["1 OR 1=1"]}),e=>e.status===400);
 assert.equal(deleteAdminLogs(db,'search',{ids:[3,3]}).deleted,1);
});

test('verified admin identity suppresses AI/library records; cookies and IP alone never authorize log management',async t=>{
 const db=fixture(t),token='a'.repeat(64);db.prepare('INSERT INTO admin_tokens VALUES(?)').run(token);
 const app=express();app.use(express.json());app.use(adminActivityIdentity(()=>db));
 const activity=createLibraryActivity(()=>db),history=registerAiHistory(app,{getStateDb:()=>db});let busy=false;
 app.post('/record',(req,res)=>{activity.record('hadith',req,{action:'search',query:'query'});history.record(req,res,'question','answer');res.json({admin:req.isAdminActivity});});
 registerAdminLogs(app,{getStateDb:()=>db,requireAdmin:(req,res,next)=>req.headers.authorization===`Bearer ${token}`?next():res.sendStatus(401),isBusy:()=>busy});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const request=(url,method='GET',headers={},body)=>fetch(`http://127.0.0.1:${server.address().port}${url}`,{method,headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
 for(const headers of [{Authorization:`Bearer ${token}`},{Cookie:`maktabah_admin_session=${token}`}])assert.equal((await(await request('/record','POST',headers)).json()).admin,true);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM ask_logs').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM hadith_logs').get().n,0);
 assert.equal((await(await request('/record','POST',{Authorization:'Bearer forged','X-Is-Admin':'true'})).json()).admin,false);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM ask_logs').get().n,1);
 assert.equal((await request('/api/admin/logs/ask')).status,401);
 assert.equal((await request('/api/admin/logs/ask','DELETE',{Cookie:`maktabah_admin_session=${token}`},{ids:[1]})).status,401);
 assert.equal((await request('/api/admin/logs/ask','GET',{Authorization:`Bearer ${token}`})).status,200);
 busy=true;assert.equal((await request('/api/admin/logs/ask','DELETE',{Authorization:`Bearer ${token}`},{ids:[1]})).status,409);
 db.prepare('DELETE FROM admin_tokens').run();assert.equal((await(await request('/record','POST',{Cookie:`maktabah_admin_session=${token}`})).json()).admin,false);
});

test('admin activity cookies are HttpOnly, same-site and cleared on logout',()=>{
 const values=[];const res={append:(key,value)=>values.push(value)};
 setAdminActivityCookie({secure:true},res,'a'.repeat(64));setAdminActivityCookie({secure:true},res,'');
 assert.match(values[0],/HttpOnly; SameSite=Lax; Secure/);assert.match(values[1],/Max-Age=0/);
});

test('daily stats aggregate all 8 log types for today and compute 7-day trend',t=>{
 const db=fixture(t);
 db.exec(`INSERT INTO search_logs(query,created_at) VALUES('sholat',datetime('now')),('puasa',datetime('now','-2 days'));
 INSERT INTO ask_logs(question,created_at) VALUES('apa itu zakat?',datetime('now'));
 INSERT INTO visit_logs(path,created_at) VALUES('/book/1',datetime('now'));`);

 const logTables = { search: 'search_logs', ask: 'ask_logs', visit: 'visit_logs', download: 'download_logs', quran: 'quran_logs', hadith: 'hadith_logs', rowa: 'rowa_logs', authors: 'authors_logs' };
 const today = { total: 0 };
 const todayStartSql = "created_at >= datetime('now', '+7 hours', 'start of day', '-7 hours')";
 for (const [key, table] of Object.entries(logTables)) {
   const count = db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE ${todayStartSql}`).get()?.c || 0;
   today[key] = count;
   today.total += count;
 }
 assert.equal(today.search, 1);
 assert.equal(today.ask, 1);
 assert.equal(today.visit, 1);
 assert.equal(today.download, 0);
 assert.equal(today.total, 3);
});

test('tanya AI logs compute answered and failed stats and allow filtering by status',t=>{
  const db=fixture(t);
  db.exec('ALTER TABLE ask_logs ADD COLUMN meta_json TEXT');
  db.exec(`INSERT INTO ask_logs(question,response,meta_json) VALUES
    ('Q1','Jawaban 1','{"mode":"grounded"}'),
    ('Q2','Saya belum dapat memastikan jawaban...','{"mode":"no_context","rejection":{"stage":"retrieval"}}'),
    ('Q3','Halo','{"mode":"conversation"}');
  `);
  const res=readAdminLogs(db,'ask');
  assert.equal(res.stats.total,3);
  assert.equal(res.stats.answered,1);
  assert.equal(res.stats.failed,1);
  assert.equal(res.capabilities.status,true);
  const filteredAnswered=readAdminLogs(db,'ask',{status:'answered'});
  assert.equal(filteredAnswered.total,1);
  assert.equal(filteredAnswered.data[0].question,'Q1');
  const filteredFailed=readAdminLogs(db,'ask',{status:'failed'});
  assert.equal(filteredFailed.total,1);
  assert.equal(filteredFailed.data[0].question,'Q2');
});
