import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import { ensureGoogleAuthSchema, registerGoogleAuth } from './google-auth.js';

function createFixture(t, { clientId = 'test-client-id', tokenMap = {} } = {}) {
  const stateDb = new Database(':memory:');
  stateDb.exec(`
    CREATE TABLE admin_tokens (token TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, name TEXT, message TEXT NOT NULL, rating INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE book_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, name TEXT, book_title TEXT NOT NULL, book_author TEXT, category_id INTEGER, notes TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE book_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, name TEXT, book_title TEXT NOT NULL, book_author TEXT, category_id INTEGER, notes TEXT, file_name TEXT, file_path TEXT, file_type TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  ensureGoogleAuthSchema(stateDb);
  const activeTokens = new Set();
  const app = express();
  app.use(express.json());
  const { optionalUser } = registerGoogleAuth(app, {
    getStateDb: () => stateDb,
    activeTokens,
    env: { GOOGLE_CLIENT_ID: clientId, ADMIN_GOOGLE_EMAILS: 'zenhkm@gmail.com' },
    fetchImpl: async (url) => {
      const idToken = decodeURIComponent(url.split('id_token=')[1] || '');
      const payload = tokenMap[idToken];
      if (!payload) return new Response(JSON.stringify({ error_description: 'Invalid token' }), { status: 400 });
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });
  app.post('/api/test/feedback', (req, res) => {
    const user = optionalUser(req);
    stateDb.prepare('INSERT INTO feedback (email, name, message, rating, user_id) VALUES (?, ?, ?, ?, ?)').run(
      user?.email || req.body.email, user?.name || req.body.name, req.body.message, 5, user?.id ?? null
    );
    res.json({ ok: true });
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); stateDb.close(); });
  return new Promise((resolve) => {
    server.once('listening', () => resolve({ base: `http://127.0.0.1:${server.address().port}`, stateDb, activeTokens }));
  });
}

test('Google login redirects admin (zenhkm@gmail.com) to #/admin and visitors to #/', async (t) => {
  const adminCred = 'admin-google-token-1234567890';
  const userCred = 'visitor-google-token-1234567890';
  const { base, activeTokens } = await createFixture(t, {
    tokenMap: {
      [adminCred]: { sub: 'sub-admin', email: 'zenhkm@gmail.com', email_verified: 'true', name: 'Zen Admin', aud: 'test-client-id' },
      [userCred]: { sub: 'sub-user', email: 'pengunjung@example.com', email_verified: 'true', name: 'Pengunjung', aud: 'test-client-id' },
    },
  });

  const cfg = await (await fetch(`${base}/api/auth/config`)).json();
  assert.equal(cfg.googleEnabled, true);
  assert.equal(cfg.clientId, 'test-client-id');

  const adminRes = await (await fetch(`${base}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: adminCred }),
  })).json();
  assert.equal(adminRes.user.role, 'admin');
  assert.equal(adminRes.redirectTo, '#/admin');
  assert.ok(adminRes.adminToken);
  assert.ok(activeTokens.has(adminRes.adminToken));

  const userRes = await (await fetch(`${base}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: userCred }),
  })).json();
  assert.equal(userRes.user.role, 'user');
  assert.equal(userRes.redirectTo, '#/');
  assert.equal(userRes.adminToken, null);
});

test('logged-in user persists opened books and feedback, and logout invalidates token', async (t) => {
  const userCred = 'visitor-google-token-1234567890';
  const { base } = await createFixture(t, {
    tokenMap: {
      [userCred]: { sub: 'sub-user', email: 'user@example.com', email_verified: 'true', name: 'User', aud: 'test-client-id' },
    },
  });

  const login = await (await fetch(`${base}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: userCred }),
  })).json();

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.userToken}` };
  await fetch(`${base}/api/user/opened-books`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bkid: 42, bk: 'صحيح البخاري', author: 'البخاري', timestamp: 1700000000000 }),
  });
  await fetch(`${base}/api/test/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'user@example.com', message: 'Sangat bermanfaat' }),
  });

  const books = await (await fetch(`${base}/api/user/opened-books`, { headers })).json();
  assert.equal(books.data.length, 1);
  assert.equal(books.data[0].bkid, 42);

  const act = await (await fetch(`${base}/api/user/activity`, { headers })).json();
  assert.equal(act.feedback.length, 1);
  assert.equal(act.feedback[0].message, 'Sangat bermanfaat');

  await fetch(`${base}/api/auth/logout`, { method: 'POST', headers, body: JSON.stringify({}) });
  const meAfterLogout = await fetch(`${base}/api/auth/me`, { headers });
  assert.equal(meAfterLogout.status, 401);
});

test('rejects unconfigured Google client ID and invalid audience', async (t) => {
  const badCred = 'bad-aud-token-123456789012345';
  const f1 = await createFixture(t, { clientId: '' });
  const r1 = await fetch(`${f1.base}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: badCred }),
  });
  assert.equal(r1.status, 503);

  const f2 = await createFixture(t, {
    clientId: 'expected-id',
    tokenMap: { [badCred]: { sub: 'x', email: 'a@b.com', email_verified: 'true', aud: 'other-id' } },
  });
  const r2 = await fetch(`${f2.base}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: badCred }),
  });
  assert.equal(r2.status, 401);
});
