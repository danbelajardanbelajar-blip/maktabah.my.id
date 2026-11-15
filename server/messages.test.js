import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import {registerMessages,cleanMessageText,createRateLimiter,MESSAGE_LIMITS} from './messages.js';
import {adminActivityIdentity} from './admin-log-identity.js';

async function fixture(t, {busy = false} = {}) {
  const db = new Database(':memory:');db.exec("CREATE TABLE admin_tokens(token TEXT PRIMARY KEY); INSERT INTO admin_tokens VALUES('admintoken')");
  let clock = Date.parse('2026-11-15T03:00:00Z');
  const app = express();app.set('trust proxy', true);app.use(express.json());app.use(adminActivityIdentity(() => db));
  const requireAdmin = (req, res, next) => req.headers.authorization === 'Bearer admintoken' ? next() : res.status(401).json({error:'Unauthorized'});
  const messages = registerMessages(app, {getStateDb:() => db, requireAdmin, isBusy:() => busy, clock:() => clock});
  const server = app.listen(0, '127.0.0.1');await new Promise(r => server.once('listening', r));
  t.after(async () => {server.closeAllConnections();await new Promise(r => server.close(r));db.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (body, cookie, extra = {}) => {
    const res = await fetch(base + '/api/messages', {method:'POST', headers:{'Content-Type':'application/json', ...(cookie ? {cookie} : {}), ...extra}, body:JSON.stringify(body)});
    return {status:res.status, json:await res.json(), cookie:res.headers.get('set-cookie')?.split(';')[0] || cookie};
  };
  const admin = (path, init = {}) => fetch(base + '/api/admin/messages' + path, {...init, headers:{Authorization:'Bearer admintoken', 'Content-Type':'application/json', ...(init.headers || {})}});
  return {db, base, send, admin, messages, tick:ms => {clock += ms;}};
}

test('message text keeps Arabic and line breaks but strips control and bidi-override characters', () => {
  assert.equal(cleanMessageText('  السلام عليكم\r\nApa kabar?\u0007‮  '), 'السلام عليكم\nApa kabar?');
  assert.equal(cleanMessageText('a\n\n\n\n\nb'), 'a\n\n\nb');
  assert.equal(cleanMessageText(42), '');
});

test('rate limiter uses a sliding window and stays bounded', () => {
  let t = 0;const limiter = createRateLimiter(() => t, 3);
  assert.ok(limiter.allow('a', 2, 1000));assert.ok(limiter.allow('a', 2, 1000));assert.equal(limiter.allow('a', 2, 1000), false);
  t = 1001;assert.ok(limiter.allow('a', 2, 1000));
  for (const key of ['b', 'c', 'd', 'e']) limiter.allow(key, 1, 1000);
  assert.ok(limiter.allow('b', 1, 1000), 'oldest key was evicted');
});

test('a visitor conversation with an admin reply stays isolated per browser and HTML is kept as text', async t => {
  const f = await fixture(t);
  const first = await f.send({body:'<img src=x onerror=alert(1)> Assalamu alaikum', name:'  Ahmad  '});
  assert.equal(first.status, 201);assert.match(first.cookie, /^maktabah_ai=[a-f0-9]{64}$/);
  assert.equal(first.json.message.body, '<img src=x onerror=alert(1)> Assalamu alaikum');assert.equal(first.json.thread.name, 'Ahmad');
  const other = await f.send({body:'Pesan browser lain'});assert.notEqual(other.cookie, first.cookie);
  const read = async cookie => (await fetch(f.base + '/api/messages', {headers:cookie ? {cookie} : {}})).json();
  assert.deepEqual((await read(first.cookie)).messages.map(m => m.body), ['<img src=x onerror=alert(1)> Assalamu alaikum']);
  assert.deepEqual(await read(), {thread:null, messages:[], unread:0});
  assert.ok(!JSON.stringify(f.db.prepare('SELECT session_id FROM visitor_message_threads').all()).includes(first.cookie.split('=')[1]), 'only the hash is stored');

  assert.equal((await f.admin('')).status, 200);assert.equal((await fetch(f.base + '/api/admin/messages')).status, 401);
  const list = await (await f.admin('')).json();
  assert.equal(list.total, 2);assert.equal(list.unread, 2);assert.equal(f.messages.adminUnread(), 2);
  const thread = list.data.find(row => row.name === 'Ahmad');assert.equal(thread.last_sender, 'visitor');assert.equal(thread.session_id, undefined);
  const detail = await (await f.admin('/' + thread.id)).json();
  assert.equal(detail.thread.admin_unread, 0);assert.equal(detail.unread, 1);assert.equal(detail.thread.session_id, undefined);
  assert.equal((await f.admin('/' + thread.id, {method:'POST', body:JSON.stringify({body:'Wa alaikumussalam'})})).status, 201);
  const after = await read(first.cookie);
  assert.equal(after.unread, 1);assert.deepEqual(after.messages.map(m => m.sender), ['visitor', 'admin']);
  assert.deepEqual((await (await fetch(f.base + `/api/messages?after=${after.messages[0].id}`, {headers:{cookie:first.cookie}})).json()).messages.map(m => m.body), ['Wa alaikumussalam']);
  await fetch(f.base + '/api/messages/read', {method:'POST', headers:{cookie:first.cookie}});
  assert.equal((await read(first.cookie)).unread, 0);

  assert.equal((await f.admin('/999', {method:'POST', body:JSON.stringify({body:'x'})})).status, 404);
  assert.equal((await f.admin('/' + thread.id, {method:'POST', body:JSON.stringify({body:'  '})})).status, 400);
  assert.equal((await f.admin('/' + thread.id, {method:'DELETE'})).status, 200);
  assert.deepEqual(await read(first.cookie), {thread:null, messages:[], unread:0});
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM visitor_messages').get().n, 1);
});

test('validation, duplicates, honeypot, rate limits and admin activity are rejected without storing', async t => {
  const f = await fixture(t);
  assert.equal((await f.send({body:'   '})).status, 400);
  assert.equal((await f.send({body:'x'.repeat(MESSAGE_LIMITS.body + 1)})).status, 400);
  const bot = await f.send({body:'spam', website:'http://spam'});assert.equal(bot.status, 200);assert.equal(bot.json.message, null);
  const admin = await f.send({body:'Halo'}, 'maktabah_admin_session=admintoken');assert.equal(admin.status, 403);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM visitor_messages').get().n, 0);

  const first = await f.send({body:'Pesan 1'});const cookie = first.cookie;
  assert.equal((await f.send({body:'Pesan 1'}, cookie)).status, 409);
  for (let i = 2; i <= MESSAGE_LIMITS.perMinute; i++) assert.equal((await f.send({body:`Pesan ${i}`}, cookie)).status, 201);
  const limited = await f.send({body:'Terlalu cepat'}, cookie);assert.equal(limited.status, 429);assert.match(limited.json.error, /Terlalu banyak/);
  f.tick(61000);
  for (let i = 6; i <= MESSAGE_LIMITS.unanswered; i++) {f.tick(13000);assert.equal((await f.send({body:`Pesan ${i}`}, cookie)).status, 201, `pesan ${i}`);}
  f.tick(61000);
  const waiting = await f.send({body:'Masih menunggu'}, cookie);assert.equal(waiting.status, 429);assert.match(waiting.json.error, /tunggu balasan admin/);
});

test('new conversations per IP are limited and maintenance blocks writes', async t => {
  const f = await fixture(t);
  for (let i = 0; i < MESSAGE_LIMITS.newThreadsPerIpHour; i++) assert.equal((await f.send({body:`Halo ${i}`}, null, {'X-Forwarded-For':'9.9.9.9'})).status, 201);
  assert.equal((await f.send({body:'Halo lagi'}, null, {'X-Forwarded-For':'9.9.9.9'})).status, 429);
  assert.equal((await f.send({body:'Halo lain'}, null, {'X-Forwarded-For':'8.8.8.8'})).status, 201);
  const busy = await fixture(t, {busy:true});
  assert.equal((await busy.send({body:'Halo'})).status, 409);
});

test('streams deliver admin replies to the visitor and visitor messages to the admin', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.base + '/api/messages/stream')).status, 204);
  assert.equal((await fetch(f.base + '/api/admin/messages/stream')).status, 401);
  const first = await f.send({body:'Halo admin'});
  const open = async (path, headers) => {
    const controller = new AbortController();t.after(() => controller.abort());
    const res = await fetch(f.base + path, {headers, signal:controller.signal});
    assert.equal(res.status, 200);assert.match(res.headers.get('content-type'), /text\/event-stream/);assert.equal(res.headers.get('x-accel-buffering'), 'no');
    const reader = res.body.getReader(), decoder = new TextDecoder();let text = '';
    return {async until(pattern) {while (!pattern.test(text)) {const {value, done} = await reader.read();if (done) throw new Error('stream closed');text += decoder.decode(value);}return text;}};
  };
  const visitor = await open('/api/messages/stream', {cookie:first.cookie});
  const adminStream = await open('/api/admin/messages/stream', {cookie:'maktabah_admin_session=admintoken'});
  await visitor.until(/retry: 5000/);await adminStream.until(/retry: 5000/);
  const id = (await (await f.admin('')).json()).data[0].id;
  await f.admin('/' + id, {method:'POST', body:JSON.stringify({body:'Balasan admin'})});
  assert.match(await visitor.until(/Balasan admin/), /event: message\ndata: .*"sender":"admin"/);
  await f.send({body:'Terima kasih'}, first.cookie);
  assert.match(await adminStream.until(/Terima kasih/), /"threadId":\d+/);
});
