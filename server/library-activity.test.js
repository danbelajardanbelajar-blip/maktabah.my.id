import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {createLibraryActivity,registerLibraryActivity,sanitizeLibraryActivity} from './library-activity.js';
import {registerAuthors} from './authors.js';

async function fixture(t) {
  const db=new Database(':memory:');
  const activity=createLibraryActivity(()=>db);
  const app=express();app.use(express.json());let busy=false;
  registerLibraryActivity(app,{activity,getBook:id=>id===10?{bk:'العنوان الحقيقي'}:null,isBusy:()=>busy});
  const service={
    authorList:query=>query.timeline==='1'?{groups:[{authors:[{id:7}]}],start:10,end:11,totalGroups:15}:{data:[{id:7}],total:1,totalPages:1},
    detail:id=>{if(id!==7)throw Object.assign(Error('Missing author'),{status:404});return {data:{id:7,name:'السيوطي'},works:[{book_id:10}],total:1,totalPages:1};},
    related:()=>[], review:()=>({data:[]}),bookCase:()=>({}),decide:()=>({}),
  };
  registerAuthors(app,{service,requireAdmin:(req,res,next)=>req.headers.authorization==='Bearer test'?next():res.sendStatus(401),onActivity:(req,event)=>activity.record('authors',req,event)});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const request=async(path,body,headers={})=>{
    const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','User-Agent':'activity-test',...headers},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json().catch(()=>null)};
  };
  return {db,activity,request,setBusy:value=>{busy=value;}};
}

test('log tables initialize idempotently and retain separate histories, UTC milliseconds, metadata and zero results',async t=>{
  const {db,activity}=await fixture(t);
  activity.initialize();createLibraryActivity(()=>db);
  const req={ip:'127.0.0.1',headers:{'user-agent':'test browser'}};
  assert.equal(activity.record('hadith',req,{action:'search',query:'نص غير موجود',result_count:0,context:{mode:'content',group:'nine',page:2}}),true);
  assert.equal(activity.record('authors',req,{action:'profile',target_id:7,target_name:'السيوطي',result_count:0}),true);
  const row=db.prepare('SELECT * FROM hadith_logs').get();
  assert.equal(row.result_count,0);assert.equal(row.ip,'127.0.0.1');assert.equal(row.user_agent,'test browser');
  assert.match(row.created_at,/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}$/);
  assert.deepEqual(JSON.parse(row.context),{mode:'content',group:'nine',page:2});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM authors_logs').get().n,1);
  assert.equal(activity.changesFor(db),2);
  assert.equal(activity.record('constructor',req,{action:'browse'}),false);
});

test('public events validate feature/action/IDs and take book titles from the actual catalogue',async t=>{
  const {db,request}=await fixture(t);
  const valid=await request('/api/log/library/hadith',{action:'read_book',target_id:10,target_name:'forged',context:{page_id:1,secret:'never store'}});
  assert.equal(valid.status,200);
  const row=db.prepare('SELECT * FROM hadith_logs').get();assert.equal(row.target_name,'العنوان الحقيقي');assert.equal(row.context,'{"page_id":1}');
  for(const [feature,event,status] of [
    ['unknown',{action:'browse'},400],['authors',{action:'profile',target_id:7},400],
    ['hadith',{action:'search',context:{mode:'content'}},400],['hadith',{action:'drop_table'},400],
    ['authors',{action:'read_book',target_id:-1},400],['authors',{action:'read_book',target_id:99},404],
  ])assert.equal((await request(`/api/log/library/${feature}`,event)).status,status);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM hadith_logs').get().n,1);
});

test('catalogue filters, edition and author timeline selections preserve bounded context without arbitrary fields',async t=>{
  const {db,request}=await fixture(t);
  assert.equal((await request('/api/log/library/hadith',{action:'search',query:'x'.repeat(800),result_count:0,context:{mode:'catalog',group:'two',available:true,matching:'phrase',apiKey:'secret'}})).status,200);
  assert.equal((await request('/api/log/library/hadith',{action:'edition',target_id:10})).status,200);
  assert.equal((await request('/api/log/library/authors',{action:'timeline_year',result_count:4,context:{year:'900 H',initial:'س',century:'10',view:'timeline'}})).status,200);
  const row=db.prepare('SELECT * FROM hadith_logs WHERE action=?').get('search');
  assert.equal(row.query.length,500);assert.equal(row.result_count,0);assert.ok(!row.context.includes('secret'));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM authors_logs').get().n,1);
  assert.throws(()=>sanitizeLibraryActivity({action:'invalid'}));
});

test('successful author list/profile/timeline calls log context, skip preliminary timeline counts, and never log admin reads or failed profiles',async t=>{
  const {db,request}=await fixture(t);
  assert.equal((await request('/api/authors?q=السيوطي&initial=س&century=10&view=cards&page=2')).status,200);
  assert.equal((await request('/api/authors/7?view=cards&page=2')).status,200);
  assert.equal((await request('/api/authors?timeline=1&q=ابن&start=10')).status,200);
  assert.equal((await request('/api/authors?view=timeline')).status,200);
  assert.equal((await request('/api/authors/999')).status,404);
  assert.equal((await request('/api/admin/authors/review')).status,401);
  await request('/api/admin/authors/review',undefined,{Authorization:'Bearer test'});
  const rows=db.prepare('SELECT * FROM authors_logs ORDER BY id').all();
  assert.deepEqual(rows.map(r=>r.action),['search','profile','timeline']);
  assert.equal(JSON.parse(rows[0].context).initial,'س');assert.equal(JSON.parse(rows[0].context).total,1);
  assert.equal(rows[1].target_name,'السيوطي');assert.equal(rows[1].target_id,7);
  assert.equal(JSON.parse(rows[2].context).total_groups,15);assert.equal(rows[2].result_count,1);
});

test('maintenance and public rate limits stop analytics writes, and analytics failure cannot break reading',async t=>{
  const {db,request,setBusy}=await fixture(t);
  setBusy(true);assert.equal((await request('/api/log/library/hadith',{action:'browse'})).status,409);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM hadith_logs').get().n,0);setBusy(false);
  for(let i=0;i<120;i++)assert.equal((await request('/api/log/library/hadith',{action:'browse'})).status,200);
  assert.equal((await request('/api/log/library/hadith',{action:'browse'})).status,429);
  const unavailable=createLibraryActivity(()=>null);assert.equal(unavailable.record('authors',{},{action:'browse'}),false);
  db.exec('DROP TABLE authors_logs');
  assert.equal((await request('/api/authors/7')).status,200);
});
