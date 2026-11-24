import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {ensureVisitTrackingSchema,registerVisitTracking} from './visit-tracking.js';
import {readAdminLogs} from './admin-logs.js';
import {adminActivityIdentity} from './admin-log-identity.js';
import {visitPath,createLogClient,startVisitTracking,recordVisit,recordSiteAction} from '../src/lib/visit-tracker.js';

const id = 'test-event-00000001';
async function fixture(t) {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE visit_logs(id INTEGER PRIMARY KEY, path TEXT, ip TEXT, user_agent TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO visit_logs(path) VALUES('home'); CREATE TABLE admin_tokens(token TEXT PRIMARY KEY); INSERT INTO admin_tokens VALUES('admin-test-token');");
  ensureVisitTrackingSchema(db); ensureVisitTrackingSchema(db);
  const app = express(); app.use(express.json()); app.use(adminActivityIdentity(()=>db));
  registerVisitTracking(app,{getStateDb:()=>db});
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const post = (path,body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  return {db,post};
}
function memoryStorage() {
  const values = new Map();
  return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
const tick = ()=>new Promise(resolve=>setImmediate(resolve));

test('canonical route logs standalone privacy, category/profile/page details and excludes admin and unresolved readers',()=>{
  const route = hash=>visitPath('https://maktab.my.id/'+hash);
  for(const path of ['/privacy-policy','/privacy-policy/','/privacy-policy.html']) assert.equal(visitPath('https://maktab.my.id'+path),'/privacy-policy');
  assert.equal(route('#/donasi'),'/donasi'); assert.equal(route('#/tentang'),'/tentang');
  assert.equal(route('#/katalog?page=2&cat=0'),'/katalog?cat=0&page=2');
  assert.notEqual(route('#/katalog?bpage=1'),route('#/katalog?bpage=2'));
  assert.notEqual(route('#/kutub-hadis?available=1'),route('#/kutub-hadis'));
  assert.notEqual(route('#/cari?scope=all&notbooks=7'),route('#/cari?scope=all&notbooks=8'));
  assert.notEqual(route('#/penulis?id=54'),route('#/penulis?id=55'));
  assert.notEqual(route('#/quran?surah=2&ayat=5'),route('#/quran?surah=2&ayat=6'));
  assert.equal(route('#/admin?view=log_visit'),null); assert.equal(route('?admin=1'),null);
  assert.equal(route('#/read/7/2'),null); assert.equal(route('#/read/7'),null);
  assert.equal(route('#/cari?q=kitab&token=secret&email=private'),'/cari?q=kitab');
});

test('schema preserves old visits, deduplicates event retries, and accepts old clients',async t=>{
  const {db,post}=await fixture(t);
  for(let n=0;n<2;n++)assert.equal((await post('/api/log/visit',{event_id:id,path:'/katalog?cat=0&page=2'})).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM visit_logs').get().n,2);
  for(let n=0;n<2;n++)await post('/api/log/visit',{path:'about'});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM visit_logs').get().n,4);
  assert.equal(db.prepare('SELECT path FROM visit_logs WHERE id=1').get().path,'home');
});

test('QRIS clicks are separate from visits, visible and filterable in admin logs',async t=>{
  const {db,post}=await fixture(t);
  for(let n=0;n<2;n++)assert.equal((await post('/api/log/site-action',{event_id:id,path:'/donasi/qris',action:'qris_download'})).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM visit_logs').get().n,1);
  assert.equal(readAdminLogs(db,'activity',{action:'qris_download'}).total,1);
  assert.equal(readAdminLogs(db,'activity',{action:'qris_view'}).total,0);
  assert.deepEqual(readAdminLogs(db,'activity').top.page,[{value:'/donasi/qris',count:1}]);
});

test('admin bearer/cookie and admin routes never inflate public log totals',async t=>{
  const {db,post}=await fixture(t);
  for(const headers of [{Authorization:'Bearer admin-test-token'},{Cookie:'maktabah_admin_session=admin-test-token'}]) {
    assert.equal((await post('/api/log/visit',{path:'/donasi',event_id:id},headers)).status,200);
    assert.equal((await post('/api/log/site-action',{path:'/donasi/qris',event_id:id,action:'qris_view'},headers)).status,200);
  }
  await post('/api/log/visit',{path:'/admin?view=books',event_id:id});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM visit_logs').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM site_action_logs').get().n,0);
});

test('validation rejects damaged events and server reports temporary persistence failures',async t=>{
  const {db,post}=await fixture(t);
  for(const body of [{path:''},{path:[]},{path:'x'.repeat(2001)},{path:'/donasi',event_id:'invalid'},{path:'bad\npath'}])assert.equal((await post('/api/log/visit',body)).status,400);
  assert.equal((await post('/api/log/site-action',{event_id:id,path:'/donasi/qris',action:'payment_success'})).status,400);
  db.exec('DROP TABLE visit_logs');
  assert.equal((await post('/api/log/visit',{path:'/donasi',event_id:id})).status,503);
});

test('lost acknowledgement retries the same event ID and server inserts exactly once',async t=>{
  const {db,post}=await fixture(t);let time=1000,calls=0;const bodies=[];
  const storage=memoryStorage();
  const client=createLogClient({storage,now:()=>time,randomId:()=>id,schedule:()=>1,cancel:()=>{},fetch:async(endpoint,options)=>{
    const body=JSON.parse(options.body);bodies.push(body);
    const response=await post(endpoint,body);
    if(++calls===1)throw Error('Lost response after persistence');
    return response;
  }});
  t.after(()=>client.stop());
  client.enqueue('visit','/donasi');
  while(calls<1)await tick(); await tick();
  assert.equal(client.size(),1); assert.equal(storage.length,1);
  time+=3000; await client.flush();
  assert.equal(client.size(),0); assert.equal(storage.length,0);
  assert.equal(bodies[0].event_id,bodies[1].event_id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM visit_logs WHERE event_id=?').get(id).n,1);
});

test('pending events survive a document change and storage-disabled logging still works',async()=>{
  const storage=memoryStorage();let time=1000;
  const offline=createLogClient({storage,now:()=>time,randomId:()=>id,schedule:()=>1,cancel:()=>{},fetch:async()=>{throw Error('offline');}});
  offline.enqueue('action','/donasi/qris','qris_view');await tick();offline.stop();
  const sent=[];time+=3000;
  const restored=createLogClient({storage,now:()=>time,schedule:()=>1,cancel:()=>{},fetch:async(url,options)=>{sent.push([url,JSON.parse(options.body)]);return {ok:true,json:async()=>({success:true})};}});
  await restored.flush();restored.stop();
  assert.equal(sent[0][0],'/api/log/site-action');assert.equal(sent[0][1].action,'qris_view');assert.equal(storage.length,0);
  const client=createLogClient({randomId:()=>id,fetch:async()=>({ok:true,json:async()=>({success:true})})});
  client.enqueue('visit','/privacy-policy');await tick();assert.equal(client.size(),0);client.stop();
});

test('retry storage is bounded and old events expire instead of replaying indefinitely',async()=>{
  const storage=memoryStorage();let time=0,count=0;
  const client=createLogClient({storage,now:()=>time,randomId:()=>`bounded-event-${String(++count).padStart(8,'0')}`,schedule:()=>1,cancel:()=>{},fetch:async()=>{throw Error('offline');}});
  for(let n=0;n<120;n++)client.enqueue('visit','/beranda');await tick();
  assert.ok(storage.length<=100);assert.ok(client.size()<=100);
  time=25*60*60*1000;await client.flush();assert.equal(client.size(),0);assert.equal(storage.length,0);client.stop();
});

test('navigation events coalesce, readers log resolved pages, QRIS stays separate, and back restores visits',async()=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  const events=[],win=new EventTarget(),doc=new EventTarget();
  win.location={href:'https://maktab.my.id/#/katalog?cat=0&page=2'};
  win.sessionStorage=memoryStorage();
  win.fetch=async(url,options)=>{events.push({url,...JSON.parse(options.body)});return {ok:true,json:async()=>({success:true})};};
  doc.visibilityState='visible';
  globalThis.window=win;globalThis.document=doc;
  const stop=startVisitTracking();
  try {
    await tick();
    win.dispatchEvent(new Event('hashchange'));win.dispatchEvent(new Event('maktabah:navigate'));await tick();
    assert.equal(events.length,1);
    win.location.href='https://maktab.my.id/#/penulis?id=54';win.dispatchEvent(new Event('maktabah:location'));await tick();
    win.location.href='https://maktab.my.id/#/read/7/9';win.dispatchEvent(new Event('maktabah:location'));await tick();
    assert.equal(events.length,2); // No fake home/catalog visit for a reader URL.
    recordVisit('/read/7/9');recordVisit('/read/7/9');recordVisit('/read/7/10');await tick();
    recordSiteAction('qris_download');await tick();
    win.location.href='https://maktab.my.id/#/penulis?id=54';win.dispatchEvent(new Event('popstate'));win.dispatchEvent(new Event('hashchange'));await tick();
    assert.deepEqual(events.filter(event=>event.url==='/api/log/visit').map(event=>event.path),[
      '/katalog?cat=0&page=2','/penulis?id=54','/read/7/9','/read/7/10','/penulis?id=54',
    ]);
    assert.equal(events.filter(event=>event.url==='/api/log/site-action').length,1);
    const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});win.dispatchEvent(restored);await tick();
    assert.equal(events.at(-1).path,'/penulis?id=54');assert.equal(events.length,7);
  } finally {
    stop();
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
});
