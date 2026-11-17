import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {registerMessages,cleanMessageText,createRateLimiter,MESSAGE_LIMITS} from './messages.js';
import {adminActivityIdentity} from './admin-log-identity.js';

const NO_ATTACHMENTS = {allowFiles:false, allowImages:false, maxImageBytes:8 * 1024 * 1024, maxFileBytes:10 * 1024 * 1024};

async function fixture(t, {busy = false} = {}) {
  const db = new Database(':memory:');db.exec("CREATE TABLE admin_tokens(token TEXT PRIMARY KEY); INSERT INTO admin_tokens VALUES('admintoken')");
  let clock = Date.parse('2026-11-15T03:00:00Z');
  const app = express();app.set('trust proxy', true);app.use(express.json());app.use(adminActivityIdentity(() => db));
  const requireAdmin = (req, res, next) => req.headers.authorization === 'Bearer admintoken' ? next() : res.status(401).json({error:'Unauthorized'});
  const attachmentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-msg-test-'));
  const messages = registerMessages(app, {getStateDb:() => db, requireAdmin, isBusy:() => busy, clock:() => clock, attachmentDir});
  const server = app.listen(0, '127.0.0.1');await new Promise(r => server.once('listening', r));
  t.after(async () => {server.closeAllConnections();await new Promise(r => server.close(r));db.close();fs.rmSync(attachmentDir, {recursive:true, force:true});});
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (body, cookie, extra = {}) => {
    const res = await fetch(base + '/api/messages', {method:'POST', headers:{'Content-Type':'application/json', ...(cookie ? {cookie} : {}), ...extra}, body:JSON.stringify(body)});
    return {status:res.status, json:await res.json(), cookie:res.headers.get('set-cookie')?.split(';')[0] || cookie};
  };
  const admin = (path, init = {}) => fetch(base + '/api/admin/messages' + path, {...init, headers:{Authorization:'Bearer admintoken', 'Content-Type':'application/json', ...(init.headers || {})}});
  return {db, base, send, admin, messages, attachmentDir, tick:ms => {clock += ms;}};
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
  assert.deepEqual(await read(), {thread:null, messages:[], unread:0, readUpTo:0, settings:NO_ATTACHMENTS});
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
  assert.deepEqual(await read(first.cookie), {thread:null, messages:[], unread:0, readUpTo:0, settings:NO_ATTACHMENTS});
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
  // A permission change reaches this visitor's open panel and other admin tabs.
  await f.admin(`/${id}/permissions`, {method:'PUT', body:JSON.stringify({allowFiles:true, allowImages:false})});
  assert.match(await visitor.until(/event: settings/), /event: settings\ndata: \{"allowFiles":true,"allowImages":false/);
  assert.match(await adminStream.until(/event: permissions/), /"allow_files":1,"allow_images":0/);
  // Read receipts: replying marks the visitor's message read (✓✓ for the visitor), and the visitor
  // reading the reply turns the admin's ✓ into ✓✓.
  assert.match(await visitor.until(/event: seen/), /event: seen\ndata: \{"readUpTo":2\}/);
  await fetch(f.base + '/api/messages/read', {method:'POST', headers:{cookie:first.cookie}});
  assert.match(await adminStream.until(/event: seen/), new RegExp(`event: seen\\ndata: \\{"threadId":${id},"visitor_read_id":3\\}`));
});

test('read receipts move forward per side and are exposed to the right party only', async t => {
  const f = await fixture(t);
  const first = await f.send({body:'Satu'});
  const state = async () => (await fetch(f.base + '/api/messages', {headers:{cookie:first.cookie}})).json();
  assert.equal((await state()).readUpTo, 0, 'sent, not yet read by the admin');
  const id = (await (await f.admin('')).json()).data[0].id;
  const detail = await (await f.admin('/' + id)).json();
  assert.equal(detail.thread.admin_read_id, 1);assert.equal(detail.thread.visitor_read_id, 0);
  assert.equal((await state()).readUpTo, 1, 'the admin opened the conversation');
  await f.send({body:'Dua'}, first.cookie);
  assert.equal((await state()).readUpTo, 1, 'a newer message is only sent');
  await f.admin('/' + id, {method:'POST', body:JSON.stringify({body:'Balasan'})});
  assert.equal((await state()).readUpTo, 3, 'replying reads everything before it');
  assert.equal((await (await f.admin('/' + id)).json()).thread.visitor_read_id, 0, 'the visitor has not opened the reply yet');
  await fetch(f.base + '/api/messages/read', {method:'POST', headers:{cookie:first.cookie}});
  const row = (await (await f.admin('')).json()).data[0];
  assert.equal(row.visitor_read_id, 3);assert.equal(row.admin_read_id, 3);
  assert.equal((await state()).thread.admin_read_id, undefined, 'the visitor sees only readUpTo');
});

test('existing conversations get read receipts from their unread counters', async t => {
  const db = new Database(':memory:');t.after(() => db.close());
  db.exec(`CREATE TABLE visitor_message_threads (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', ip TEXT, user_agent TEXT,
      visitor_unread INTEGER NOT NULL DEFAULT 0, admin_unread INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE visitor_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '');
    INSERT INTO visitor_message_threads(session_id, visitor_unread, admin_unread) VALUES('a', 0, 2), ('b', 1, 0);
    INSERT INTO visitor_messages(thread_id, sender, body) VALUES(1,'visitor','v1'),(1,'admin','a1'),(1,'visitor','v2'),(1,'visitor','v3'),(2,'visitor','x'),(2,'admin','y');`);
  const {store} = registerMessages(express(), {getStateDb:() => db, requireAdmin:(q, r, n) => n()});
  const a = store.thread(1), b = store.thread(2);
  assert.equal(a.admin_read_id, 1, 'two unread visitor messages: the admin read up to v1');
  assert.equal(a.visitor_read_id, 4, 'nothing unread for the visitor');
  assert.equal(b.admin_read_id, 6);assert.ok(b.visitor_read_id < 6, 'the admin reply is still unread');
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const pdf = Buffer.from('%PDF-1.4\n%test\n');

test('attachments follow the per-conversation permission, are typed by content and only reach their own conversation', async t => {
  const f = await fixture(t);
  const image = {name:'tangkapan.png', data:'data:image/png;base64,' + PNG.toString('base64')};
  const blocked = await f.send({body:'', attachment:image});
  assert.equal(blocked.status, 403);assert.match(blocked.json.error, /gambar/);
  assert.equal(fs.readdirSync(f.attachmentDir).length, 0);

  const start = await f.send({body:'Boleh kirim tangkapan layar?'});
  const other = await f.send({body:'Saya pengunjung lain'});
  const ids = Object.fromEntries((await (await f.admin('')).json()).data.map(row => [row.last_body, row.id]));
  const threadId = ids['Boleh kirim tangkapan layar?'];
  const permit = (id, value) => f.admin(`/${id}/permissions`, {method:'PUT', body:JSON.stringify(value)});
  assert.equal((await fetch(f.base + `/api/admin/messages/${threadId}/permissions`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:'{}'})).status, 401);
  assert.equal((await permit(threadId, {allowFiles:'ya', allowImages:true})).status, 400);
  assert.equal((await permit(999, {allowFiles:false, allowImages:true})).status, 404);
  assert.deepEqual(await (await permit(threadId, {allowFiles:false, allowImages:true})).json(), {success:true, allow_files:0, allow_images:1});
  const settingsOf = async cookie => (await (await fetch(f.base + '/api/messages', {headers:{cookie}})).json()).settings;
  assert.equal((await settingsOf(start.cookie)).allowImages, true);
  assert.equal((await settingsOf(other.cookie)).allowImages, false, 'the permission belongs to one conversation only');
  assert.equal((await f.send({body:'', attachment:image}, other.cookie)).status, 403);
  const detail = await (await f.admin('/' + threadId)).json();
  assert.equal(detail.thread.allow_images, 1);assert.equal(detail.thread.allow_files, 0);

  const sent = await f.send({body:'', attachment:image}, start.cookie);
  assert.equal(sent.status, 201);
  assert.deepEqual(sent.json.message.attachment, {kind:'image', name:'tangkapan.png', mime:'image/png', size:PNG.length, url:`/api/messages/attachments/${sent.json.message.id}`});
  assert.equal(sent.json.message.attachment_file, undefined, 'the stored file name stays on the server');
  assert.equal((await f.send({body:'Berkas', attachment:{name:'surat.pdf', data:pdf.toString('base64')}}, sent.cookie)).status, 403, 'files are still off');
  // An HTML page renamed to .png, an SVG and an executable are refused whatever their name says.
  for (const attachment of [{name:'x.png', data:Buffer.from('<html><script>alert(1)</script>').toString('base64')}, {name:'x.svg', data:Buffer.from('<svg onload=alert(1)>').toString('base64')}, {name:'x.exe', data:Buffer.from('MZ').toString('base64')}])
    assert.equal((await f.send({body:'', attachment}, sent.cookie)).status, 400, attachment.name);

  const url = f.base + sent.json.message.attachment.url;
  const own = await fetch(url, {headers:{cookie:sent.cookie}});
  assert.equal(own.status, 200);assert.equal(own.headers.get('content-type'), 'image/png');
  assert.equal(own.headers.get('x-content-type-options'), 'nosniff');assert.match(own.headers.get('content-security-policy'), /sandbox/);
  assert.match(own.headers.get('content-disposition'), /^inline; filename="tangkapan.png"/);
  assert.deepEqual(Buffer.from(await own.arrayBuffer()), PNG);
  assert.match((await fetch(url + '?download=1', {headers:{cookie:sent.cookie}})).headers.get('content-disposition'), /^attachment/);
  assert.equal((await fetch(url)).status, 404, 'anonymous browsers cannot open it');
  assert.equal((await fetch(url, {headers:{cookie:other.cookie}})).status, 404, 'another visitor cannot open it');
  assert.equal((await fetch(url, {headers:{Authorization:'Bearer admintoken'}})).status, 200, 'the admin can open it');

  const list = await (await f.admin('?q=tangkapan.png')).json();
  assert.equal(list.total, 1);assert.equal(list.data[0].last_body, '📷 tangkapan.png');assert.equal(list.data[0].allow_images, 1);

  // Withdrawing the permission stops further pictures from this visitor.
  await permit(threadId, {allowFiles:false, allowImages:false});
  assert.equal((await f.send({body:'', attachment:image}, start.cookie)).status, 403);

  // Admin replies may carry any supported file even while visitors may not send files.
  const reply = await (await f.admin('/' + threadId, {method:'POST', body:JSON.stringify({body:'', attachment:{name:'جدول الدروس.pdf', data:pdf.toString('base64')}})})).json();
  assert.equal(reply.message.attachment.kind, 'file');
  const download = await fetch(f.base + reply.message.attachment.url, {headers:{cookie:sent.cookie}});
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.match(download.headers.get('content-disposition'), /^attachment; filename="_+ _+\.pdf"; filename\*=UTF-8''%D8%AC/);
  assert.equal(fs.readdirSync(f.attachmentDir).length, 2);

  assert.equal((await f.admin('/' + threadId, {method:'DELETE'})).status, 200);
  await new Promise(r => setTimeout(r, 100));
  assert.equal(fs.readdirSync(f.attachmentDir).length, 0, 'deleting a conversation deletes its files');
  assert.equal((await fetch(url, {headers:{Authorization:'Bearer admintoken'}})).status, 404);
});

test('an existing message table gains the attachment columns without losing messages', async t => {
  const db = new Database(':memory:');t.after(() => db.close());
  db.exec("CREATE TABLE visitor_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL); INSERT INTO visitor_messages(thread_id,sender,body,created_at) VALUES(1,'visitor','lama','2026-11-15T00:00:00Z')");
  const {store} = registerMessages(express(), {getStateDb:() => db, requireAdmin:(q, r, n) => n()});
  assert.deepEqual(store.messages(1), [{id:1, sender:'visitor', body:'lama', created_at:'2026-11-15T00:00:00Z', attachment:null}]);
  assert.ok(db.prepare('PRAGMA table_info(visitor_messages)').all().some(c => c.name === 'attachment_file'));
});
