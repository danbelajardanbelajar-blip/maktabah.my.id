import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {browserSession} from './ai-history.js';
import {ATTACHMENT_LIMITS,contentDisposition,createAttachmentStorage,parseAttachment} from './message-attachments.js';

// Visitor ↔ admin messages. Visitors are identified only by the anonymous browser cookie (hashed);
// admins reply from the admin panel. Text is stored as plain text and always rendered as text, never HTML.
export const MESSAGE_LIMITS = {body:2000, name:80, perMinute:5, perHour:30, ipPerHour:60, newThreadsPerIpHour:10, unanswered:15, duplicateMs:10*60*1000, page:200};
const STREAM_LIMITS = {total:1000, perSession:4, pingMs:25000};
const now = () => new Date().toISOString();
const iso = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

// Bidi overrides/isolates can disguise text direction (a spoofing trick); other control characters are noise.
export function cleanMessageText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/\r\n?/g,'\n')
    .replace(/[‪-‮⁦-⁩]/g,'')
    .replace(/\p{Cc}/gu,char=>char==='\n'||char==='\t'?char:'')
    .replace(/\n{4,}/g,'\n\n\n').trim();
}

// The stored file name never leaves the server; clients fetch attachments by message id.
export function publicMessage(row) {
  const {attachment_kind:kind, attachment_name:name, attachment_mime:mime, attachment_size:size, ...message} = row;
  return {...message, attachment:kind ? {kind, name, mime:String(mime || '').split(';')[0], size:Number(size) || 0, url:`/api/messages/attachments/${row.id}`} : null};
}

export function createMessageStore(getStateDb) {
  let initialized;
  const db = () => {
    const current = getStateDb();
    if (!current) throw new Error('Penyimpanan pesan belum tersedia.');
    if (initialized !== current) {
      current.exec(`CREATE TABLE IF NOT EXISTS visitor_message_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
        ip TEXT, user_agent TEXT, visitor_unread INTEGER NOT NULL DEFAULT 0, admin_unread INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (${iso}), updated_at TEXT NOT NULL DEFAULT (${iso}));
      CREATE TABLE IF NOT EXISTS visitor_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL, sender TEXT NOT NULL CHECK(sender IN ('visitor','admin')),
        body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (${iso}));
      CREATE INDEX IF NOT EXISTS visitor_messages_thread ON visitor_messages(thread_id,id);
      CREATE INDEX IF NOT EXISTS visitor_message_threads_updated ON visitor_message_threads(updated_at);
      CREATE TABLE IF NOT EXISTS visitor_message_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      // Attachments arrived after the first release; existing databases gain the columns in place.
      const columns = new Set(current.prepare('PRAGMA table_info(visitor_messages)').all().map(c => c.name));
      for (const [name, type] of [['attachment_kind','TEXT'],['attachment_name','TEXT'],['attachment_mime','TEXT'],['attachment_size','INTEGER'],['attachment_file','TEXT']])
        if (!columns.has(name)) current.exec(`ALTER TABLE visitor_messages ADD COLUMN ${name} ${type}`);
      initialized = current;
    }
    return current;
  };
  const threadBySession = sessionId => db().prepare('SELECT * FROM visitor_message_threads WHERE session_id=?').get(sessionId);
  const thread = id => db().prepare('SELECT * FROM visitor_message_threads WHERE id=?').get(id);
  const COLUMNS = 'id,sender,body,created_at,attachment_kind,attachment_name,attachment_mime,attachment_size';
  const messages = (threadId, after = 0, limit = MESSAGE_LIMITS.page) => (after > 0
    ? db().prepare(`SELECT ${COLUMNS} FROM visitor_messages WHERE thread_id=? AND id>? ORDER BY id LIMIT ?`).all(threadId, after, limit)
    : db().prepare(`SELECT * FROM (SELECT ${COLUMNS} FROM visitor_messages WHERE thread_id=? ORDER BY id DESC LIMIT ?) ORDER BY id`).all(threadId, limit)).map(publicMessage);
  function add(threadRow, sender, body, attachment = null) {
    const d = db(), created = now();
    return d.transaction(() => {
      const id = Number(d.prepare('INSERT INTO visitor_messages(thread_id,sender,body,created_at,attachment_kind,attachment_name,attachment_mime,attachment_size,attachment_file) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(threadRow.id, sender, body, created, attachment?.kind ?? null, attachment?.name ?? null, attachment?.mime ?? null, attachment?.size ?? null, attachment?.file ?? null).lastInsertRowid);
      d.prepare(`UPDATE visitor_message_threads SET updated_at=?, ${sender === 'visitor' ? 'admin_unread=admin_unread+1' : 'visitor_unread=visitor_unread+1'} WHERE id=?`).run(created, threadRow.id);
      return publicMessage({id, sender, body, created_at:created, attachment_kind:attachment?.kind, attachment_name:attachment?.name, attachment_mime:attachment?.mime, attachment_size:attachment?.size});
    })();
  }
  return {
    db, threadBySession, thread, messages, add,
    attachment(messageId) { return db().prepare('SELECT m.id,m.attachment_kind,m.attachment_name,m.attachment_mime,m.attachment_file,t.session_id FROM visitor_messages m JOIN visitor_message_threads t ON t.id=m.thread_id WHERE m.id=? AND m.attachment_file IS NOT NULL').get(messageId); },
    attachmentFiles(threadId) { return db().prepare('SELECT attachment_file FROM visitor_messages WHERE thread_id=? AND attachment_file IS NOT NULL').all(threadId).map(r => r.attachment_file); },
    settings() {
      const rows = Object.fromEntries(db().prepare('SELECT key,value FROM visitor_message_settings').all().map(r => [r.key, r.value]));
      return {allowFiles:rows.allow_files === '1', allowImages:rows.allow_images === '1'};
    },
    saveSettings({allowFiles, allowImages}) {
      const d = db(), put = d.prepare('INSERT INTO visitor_message_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      d.transaction(() => { put.run('allow_files', allowFiles ? '1' : '0'); put.run('allow_images', allowImages ? '1' : '0'); })();
    },
    createThread(sessionId, {name = '', ip = '', userAgent = ''}) {
      const created = now();
      db().prepare('INSERT OR IGNORE INTO visitor_message_threads(session_id,name,ip,user_agent,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(sessionId, name, ip, userAgent, created, created);
      return threadBySession(sessionId);
    },
    rename(threadId, name) { if (name) db().prepare('UPDATE visitor_message_threads SET name=? WHERE id=?').run(name, threadId); },
    unansweredCount(threadId) {
      return db().prepare("SELECT count(*) AS n FROM visitor_messages WHERE thread_id=? AND sender='visitor' AND id>coalesce((SELECT max(id) FROM visitor_messages WHERE thread_id=? AND sender='admin'),0)").get(threadId, threadId).n;
    },
    lastVisitorMessage(threadId) { return db().prepare("SELECT body,created_at FROM visitor_messages WHERE thread_id=? AND sender='visitor' ORDER BY id DESC LIMIT 1").get(threadId); },
    markRead(threadId, reader) { db().prepare(`UPDATE visitor_message_threads SET ${reader === 'admin' ? 'admin_unread' : 'visitor_unread'}=0 WHERE id=?`).run(threadId); },
    adminUnread() { return db().prepare('SELECT coalesce(sum(admin_unread),0) AS n FROM visitor_message_threads').get().n; },
    list({page = 1, limit = 20, q = ''} = {}) {
      const where = q ? "WHERE t.name LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM visitor_messages m WHERE m.thread_id=t.id AND (m.body LIKE ? ESCAPE '\\' OR m.attachment_name LIKE ? ESCAPE '\\'))" : '';
      const like = `%${q.replace(/[\\%_]/g, c => '\\' + c)}%`, args = q ? [like, like, like] : [];
      const total = db().prepare(`SELECT count(*) AS n FROM visitor_message_threads t ${where}`).get(...args).n;
      const pages = Math.max(1, Math.ceil(total / limit)), current = Math.min(Math.max(1, page), pages);
      const data = db().prepare(`SELECT t.id,t.name,t.ip,t.user_agent,t.admin_unread,t.visitor_unread,t.created_at,t.updated_at,
        (SELECT CASE WHEN m.body='' AND m.attachment_name IS NOT NULL THEN (CASE WHEN m.attachment_kind='image' THEN '📷 ' ELSE '📎 ' END)||m.attachment_name ELSE m.body END FROM visitor_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
        (SELECT sender FROM visitor_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
        (SELECT count(*) FROM visitor_messages m WHERE m.thread_id=t.id) AS message_count
        FROM visitor_message_threads t ${where} ORDER BY t.updated_at DESC, t.id DESC LIMIT ? OFFSET ?`).all(...args, limit, (current - 1) * limit);
      return {data, total, page:current, pages, unread:this.adminUnread()};
    },
    remove(threadId) {
      const d = db();
      return d.transaction(() => { d.prepare('DELETE FROM visitor_messages WHERE thread_id=?').run(threadId); return d.prepare('DELETE FROM visitor_message_threads WHERE id=?').run(threadId).changes; })();
    },
  };
}

// Sliding-window counters kept in memory; bounded so a flood of keys cannot grow without limit.
export function createRateLimiter(clock = Date.now, maxKeys = 5000) {
  const hits = new Map();
  return {
    allow(key, limit, windowMs) {
      const t = clock(), list = (hits.get(key) || []).filter(at => t - at < windowMs);
      if (list.length >= limit) { hits.set(key, list); return false; }
      list.push(t); hits.delete(key); hits.set(key, list);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
      return true;
    },
  };
}

function createHub() {
  const visitors = new Map(), admins = new Set();
  let total = 0;
  const write = (res, event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* Closed streams are removed on 'close'. */ } };
  function open(req, res, set, onClose) {
    res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-store, no-transform', Connection:'keep-alive', 'X-Accel-Buffering':'no'});
    res.write('retry: 5000\n\n');
    total++; set.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignored */ } }, STREAM_LIMITS.pingMs);
    ping.unref?.();
    req.on('close', () => { clearInterval(ping); if (set.delete(res)) total--; onClose?.(); });
  }
  return {
    get total() { return total; },
    visitorCount: id => visitors.get(id)?.size || 0,
    subscribeVisitor(req, res, id) {
      if (!visitors.has(id)) visitors.set(id, new Set());
      const set = visitors.get(id);
      open(req, res, set, () => { if (!set.size) visitors.delete(id); });
    },
    subscribeAdmin(req, res) { open(req, res, admins); },
    toVisitor(id, event, data) { for (const res of visitors.get(id) || []) write(res, event, data); },
    toAllVisitors(event, data) { for (const set of visitors.values()) for (const res of set) write(res, event, data); },
    toAdmins(event, data) { for (const res of admins) write(res, event, data); },
  };
}

export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => false, clock = Date.now, attachmentDir = path.join(os.tmpdir(), 'maktabah-message-attachments')}) {
  const store = createMessageStore(getStateDb), limiter = createRateLimiter(clock), hub = createHub(), files = createAttachmentStorage(attachmentDir);
  try { store.db(); } catch { /* Created on first use when the state database becomes available. */ }
  const fail = (res, error) => res.status(503).json({error:error?.message?.startsWith('Penyimpanan') ? error.message : 'Pesan belum dapat diproses. Silakan coba lagi.'});
  const threadId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : 0;
  const publicThread = row => row ? {id:row.id, name:row.name} : null;
  const publicSettings = () => ({...store.settings(), maxImageBytes:ATTACHMENT_LIMITS.imageBytes, maxFileBytes:ATTACHMENT_LIMITS.fileBytes});
  // Validates an optional attachment in memory; it is written to disk only once every other check passed.
  const takeAttachment = (input, allowed) => {
    if (input == null) return null;
    const parsed = parseAttachment(input);
    if (allowed && !allowed[parsed.kind]) throw Object.assign(new Error(parsed.kind === 'image' ? 'Admin belum mengizinkan pengiriman gambar.' : 'Admin belum mengizinkan pengiriman file.'), {status:403});
    return {kind:parsed.kind, name:parsed.name, mime:parsed.mime, size:parsed.buffer.length, parsed};
  };
  const storeAttachment = attachment => attachment ? {...attachment, file:files.save(attachment.parsed)} : null;
  const rejectAttachment = (res, error) => error.status ? res.status(error.status).json({error:error.message}) : fail(res, error);

  app.get('/api/messages', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const session = browserSession(req, res);
    try {
      const settings = publicSettings();
      const row = session && store.threadBySession(session);
      if (!row) return res.json({thread:null, messages:[], unread:0, settings});
      res.json({thread:publicThread(row), messages:store.messages(row.id, threadId(req.query.after)), unread:row.visitor_unread, settings});
    } catch (error) { fail(res, error); }
  });

  app.post('/api/messages', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.isAdminActivity) return res.status(403).json({error:'Anda masuk sebagai admin. Balas pesan pengunjung dari panel admin.'});
    if (isBusy()) return res.status(409).json({error:'Database sedang diperbarui. Coba kirim pesan beberapa saat lagi.'});
    // Bots fill every field; people never see this one. Accept silently so the bot learns nothing.
    if (typeof req.body?.website === 'string' && req.body.website.trim()) return res.json({success:true, message:null});
    const raw = typeof req.body?.body === 'string' ? req.body.body : '';
    const body = cleanMessageText(raw), name = cleanMessageText(req.body?.name).replace(/\s+/g, ' ').slice(0, MESSAGE_LIMITS.name);
    if (body.length > MESSAGE_LIMITS.body) return res.status(400).json({error:`Pesan maksimal ${MESSAGE_LIMITS.body.toLocaleString('id-ID')} karakter.`});
    let attachment;
    try {
      const settings = store.settings();
      attachment = takeAttachment(req.body?.attachment, {image:settings.allowImages, file:settings.allowFiles});
    } catch (error) { return rejectAttachment(res, error); }
    if (!body && !attachment) return res.status(400).json({error:'Pesan tidak boleh kosong.'});
    const session = browserSession(req, res, true), ip = String(req.ip || 'unknown').slice(0, 100);
    let saved = null;
    try {
      let row = store.threadBySession(session);
      if (!row && !limiter.allow(`new:${ip}`, MESSAGE_LIMITS.newThreadsPerIpHour, 3600000)) return res.status(429).json({error:'Terlalu banyak percakapan baru dari jaringan ini. Coba lagi nanti.'});
      if (row) {
        const last = store.lastVisitorMessage(row.id);
        if (!attachment && last && last.body === body && clock() - Date.parse(last.created_at) < MESSAGE_LIMITS.duplicateMs) return res.status(409).json({error:'Pesan yang sama baru saja terkirim.'});
        if (store.unansweredCount(row.id) >= MESSAGE_LIMITS.unanswered) return res.status(429).json({error:'Mohon tunggu balasan admin sebelum mengirim pesan lagi.'});
      }
      if (!limiter.allow(`min:${session}`, MESSAGE_LIMITS.perMinute, 60000) || !limiter.allow(`hour:${session}`, MESSAGE_LIMITS.perHour, 3600000) || !limiter.allow(`ip:${ip}`, MESSAGE_LIMITS.ipPerHour, 3600000))
        return res.status(429).json({error:'Terlalu banyak pesan. Silakan tunggu sebentar.'});
      if (attachment && (!limiter.allow(`att:${session}`, ATTACHMENT_LIMITS.perHour, 3600000) || !limiter.allow(`attip:${ip}`, ATTACHMENT_LIMITS.ipPerHour, 3600000)))
        return res.status(429).json({error:'Terlalu banyak lampiran. Silakan coba lagi nanti.'});
      saved = storeAttachment(attachment);
      row ||= store.createThread(session, {name, ip, userAgent:String(req.headers['user-agent'] || '').slice(0, 500)});
      if (name && name !== row.name) { store.rename(row.id, name); row = {...row, name}; }
      const message = store.add(row, 'visitor', body, saved);
      saved = null;
      hub.toVisitor(session, 'message', {message});
      hub.toAdmins('message', {threadId:row.id, name:row.name, message, unread:store.adminUnread()});
      res.status(201).json({success:true, thread:publicThread(row), message});
    } catch (error) { fail(res, error); } finally { if (saved) files.remove([saved.file]); }
  });

  app.post('/api/messages/read', (req, res) => {
    const session = browserSession(req, res);
    try {
      const row = session && store.threadBySession(session);
      if (row) { store.markRead(row.id, 'visitor'); hub.toVisitor(session, 'read', {unread:0}); }
      res.json({success:true, unread:0});
    } catch (error) { fail(res, error); }
  });

  app.get('/api/messages/stream', (req, res) => {
    const session = browserSession(req, res);
    if (!session) return res.status(204).end(); // 204 tells EventSource not to reconnect.
    if (hub.total >= STREAM_LIMITS.total || hub.visitorCount(session) >= STREAM_LIMITS.perSession) return res.status(429).json({error:'Terlalu banyak koneksi.'});
    hub.subscribeVisitor(req, res, session);
  });

  // EventSource cannot send an Authorization header, so the admin stream relies on the HttpOnly admin cookie.
  app.get('/api/admin/messages/stream', (req, res) => {
    if (!req.isAdminActivity) return res.status(401).json({error:'Unauthorized'});
    if (hub.total >= STREAM_LIMITS.total) return res.status(429).json({error:'Terlalu banyak koneksi.'});
    hub.subscribeAdmin(req, res);
  });

  // Only the visitor whose browser owns the conversation, or an admin, can open an attachment.
  app.get('/api/messages/attachments/:id', (req, res) => {
    try {
      const row = store.attachment(threadId(req.params.id));
      const session = browserSession(req, res);
      if (!row || !(req.isAdminActivity || (session && row.session_id === session))) return res.status(404).json({error:'Lampiran tidak ditemukan.'});
      const full = files.resolve(row.attachment_file);
      if (!full || !fs.existsSync(full)) return res.status(404).json({error:'Lampiran tidak ditemukan.'});
      const inline = row.attachment_kind === 'image' && req.query.download !== '1';
      res.set({'Content-Type':row.attachment_mime, 'Content-Disposition':contentDisposition(inline ? 'inline' : 'attachment', row.attachment_name),
        'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        'Cache-Control':'private, max-age=86400', 'Cross-Origin-Resource-Policy':'same-origin'});
      fs.createReadStream(full).on('error', () => res.destroy()).pipe(res);
    } catch (error) { fail(res, error); }
  });

  // Registered before /api/admin/messages/:id so "settings" is not read as a conversation id.
  app.get('/api/admin/messages/settings', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(publicSettings()); } catch (error) { fail(res, error); }
  });
  app.put('/api/admin/messages/settings', requireAdmin, (req, res) => {
    const {allowFiles, allowImages} = req.body || {};
    if (typeof allowFiles !== 'boolean' || typeof allowImages !== 'boolean') return res.status(400).json({error:'Pengaturan tidak valid.'});
    try {
      store.saveSettings({allowFiles, allowImages});
      const settings = publicSettings();
      hub.toAllVisitors('settings', settings);
      res.json(settings);
    } catch (error) { fail(res, error); }
  });

  app.get('/api/admin/messages', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 20));
      res.json(store.list({page:parseInt(req.query.page) || 1, limit, q:cleanMessageText(req.query.q).slice(0, 100)}));
    } catch (error) { fail(res, error); }
  });

  app.get('/api/admin/messages/:id', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const row = store.thread(threadId(req.params.id));
      if (!row) return res.status(404).json({error:'Percakapan tidak ditemukan.'});
      store.markRead(row.id, 'admin');
      const unread = store.adminUnread();
      hub.toAdmins('read', {threadId:row.id, unread});
      res.json({thread:{...row, admin_unread:0, session_id:undefined}, messages:store.messages(row.id, threadId(req.query.after), 500), unread});
    } catch (error) { fail(res, error); }
  });

  app.post('/api/admin/messages/:id', requireAdmin, (req, res) => {
    if (isBusy()) return res.status(409).json({error:'Database sedang diperbarui. Coba balas beberapa saat lagi.'});
    const body = cleanMessageText(req.body?.body);
    if (body.length > MESSAGE_LIMITS.body) return res.status(400).json({error:`Balasan maksimal ${MESSAGE_LIMITS.body.toLocaleString('id-ID')} karakter.`});
    let attachment;
    // Admin replies may always carry an attachment; the switches only govern visitors.
    try { attachment = takeAttachment(req.body?.attachment); } catch (error) { return rejectAttachment(res, error); }
    if (!body && !attachment) return res.status(400).json({error:'Balasan tidak boleh kosong.'});
    let saved = null;
    try {
      const row = store.thread(threadId(req.params.id));
      if (!row) return res.status(404).json({error:'Percakapan tidak ditemukan.'});
      saved = storeAttachment(attachment);
      const message = store.add(row, 'admin', body, saved);
      saved = null;
      store.markRead(row.id, 'admin');
      const visitorUnread = store.thread(row.id).visitor_unread;
      hub.toVisitor(row.session_id, 'message', {message, unread:visitorUnread});
      hub.toAdmins('message', {threadId:row.id, name:row.name, message, unread:store.adminUnread()});
      res.status(201).json({success:true, message});
    } catch (error) { fail(res, error); } finally { if (saved) files.remove([saved.file]); }
  });

  app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => {
    try {
      const row = store.thread(threadId(req.params.id));
      if (!row) return res.status(404).json({error:'Percakapan tidak ditemukan.'});
      const attached = store.attachmentFiles(row.id);
      store.remove(row.id);
      files.remove(attached);
      hub.toVisitor(row.session_id, 'reset', {});
      hub.toAdmins('deleted', {threadId:row.id, unread:store.adminUnread()});
      res.json({success:true});
    } catch (error) { fail(res, error); }
  });

  return {store, adminUnread:() => { try { return store.adminUnread(); } catch { return 0; } }};
}
