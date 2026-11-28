import crypto from 'node:crypto';

const DEFAULT_ADMIN_EMAILS = ['zenhkm@gmail.com'];

export function parseAdminEmails(raw = process.env.ADMIN_GOOGLE_EMAILS) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list.length ? list : DEFAULT_ADMIN_EMAILS);
}

export function ensureGoogleAuthSchema(stateDb) {
  if (!stateDb) return;
  stateDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_opened_books (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      author_name TEXT,
      page_id INTEGER,
      part TEXT,
      page TEXT,
      last_opened_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, book_id)
    );
  `);
  for (const col of ['page_id INTEGER', 'part TEXT', 'page TEXT']) {
    try {
      stateDb.exec(`ALTER TABLE user_opened_books ADD COLUMN ${col};`);
    } catch {}
  }
  for (const tbl of ['feedback', 'book_requests', 'book_submissions']) {
    try {
      stateDb.exec(`ALTER TABLE ${tbl} ADD COLUMN user_id INTEGER;`);
    } catch {}
  }
}

export async function verifyGoogleCredential(credential, { clientId, fetchImpl = fetch }) {
  if (!clientId) {
    const err = new Error('Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID belum diatur).');
    err.status = 503;
    throw err;
  }
  if (typeof credential !== 'string' || credential.length < 20) {
    const err = new Error('Token Google tidak valid.');
    err.status = 400;
    throw err;
  }
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const res = await fetchImpl(url);
  const info = await res.json().catch(() => ({}));
  if (!res.ok || !info.sub || !info.email) {
    const err = new Error('Verifikasi token Google gagal.');
    err.status = 401;
    throw err;
  }
  if (info.aud !== clientId) {
    const err = new Error('Client ID Google tidak cocok.');
    err.status = 401;
    throw err;
  }
  if (info.email_verified !== true && info.email_verified !== 'true') {
    const err = new Error('Email Google belum terverifikasi.');
    err.status = 401;
    throw err;
  }
  return {
    sub: String(info.sub),
    email: String(info.email).trim().toLowerCase(),
    name: String(info.name || info.email.split('@')[0] || '').trim(),
    picture: String(info.picture || '').trim(),
  };
}

export function registerGoogleAuth(app, {
  getStateDb,
  activeTokens,
  setAdminActivityCookie = () => {},
  fetchImpl = fetch,
  env = process.env,
}) {
  const getClientId = () => String(env.GOOGLE_CLIENT_ID || '').trim();
  const getClientSecret = () => String(env.GOOGLE_CLIENT_SECRET || '').trim();
  const getAdminEmails = () => parseAdminEmails(env.ADMIN_GOOGLE_EMAILS);
  const oauthStates = new Map();
  const appAuthCodes = new Map();

  const pruneExpired = (map) => {
    const now = Date.now();
    for (const [k, v] of map.entries()) {
      if (!v || v.expiresAt <= now) map.delete(k);
    }
  };

  const issueSessionForProfile = (stateDb, profile, req, res, setCookie = true) => {
    const isAdmin = getAdminEmails().has(profile.email);
    const role = isAdmin ? 'admin' : 'user';

    stateDb.prepare(
      `INSERT INTO users (google_sub, email, name, picture, role, last_login_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(google_sub) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture = excluded.picture,
         role = excluded.role,
         last_login_at = CURRENT_TIMESTAMP`
    ).run(profile.sub, profile.email, profile.name, profile.picture, role);

    const user = stateDb.prepare(
      'SELECT id, email, name, picture, role FROM users WHERE google_sub = ?'
    ).get(profile.sub);

    const userToken = crypto.randomBytes(32).toString('hex');
    stateDb.prepare('INSERT INTO user_tokens (token, user_id) VALUES (?, ?)').run(userToken, user.id);

    let adminToken = null;
    if (isAdmin) {
      adminToken = crypto.randomBytes(32).toString('hex');
      activeTokens?.add(adminToken);
      try {
        stateDb.prepare('INSERT INTO admin_tokens (token) VALUES (?)').run(adminToken);
      } catch {}
      if (setCookie) setAdminActivityCookie(req, res, adminToken);
    }

    return {
      user,
      userToken,
      adminToken,
      redirectTo: isAdmin ? '#/admin' : '#/',
    };
  };

  const resolveCallbackUrl = (req) => {
    const configured = String(env.GOOGLE_REDIRECT_URI || '').trim();
    if (configured) return configured;
    const host = req.get('x-forwarded-host') || req.get('host') || 'maktab.my.id';
    const proto = host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    return `${proto}://${host}/api/auth/google/callback`;
  };

  const resolveUserFromToken = (token) => {
    const stateDb = getStateDb();
    if (!stateDb || !token) return null;
    try {
      return stateDb.prepare(
        `SELECT u.id, u.email, u.name, u.picture, u.role
         FROM user_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token = ?`
      ).get(token) || null;
    } catch {
      return null;
    }
  };

  const extractBearer = (req) => {
    const header = req.headers['x-user-token'] || req.headers.authorization || '';
    if (typeof header !== 'string') return '';
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    return header.trim();
  };

  const optionalUser = (req) => resolveUserFromToken(extractBearer(req));

  const requireUser = (req, res, next) => {
    const user = optionalUser(req);
    if (!user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    req.user = user;
    next();
  };

  app.get('/api/auth/config', (_req, res) => {
    const clientId = getClientId();
    const clientSecret = getClientSecret();
    res.set('Cache-Control', 'no-store').json({
      googleEnabled: Boolean(clientId),
      appOAuthEnabled: Boolean(clientId && clientSecret),
      clientId: clientId || '',
    });
  });

  app.get('/api/auth/google/start', (req, res) => {
    const clientId = getClientId();
    const clientSecret = getClientSecret();
    if (!clientId || !clientSecret) {
      return res.status(503).send('<h3>Login Google aplikasi belum dikonfigurasi (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diatur di server).</h3>');
    }
    pruneExpired(oauthStates);
    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
    const redirectUri = resolveCallbackUrl(req);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    res.redirect(authUrl.toString());
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const stateDb = getStateDb();
    if (!stateDb) return res.status(503).send('Database sesi belum siap.');
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    pruneExpired(oauthStates);
    if (!state || !oauthStates.has(state) || !code) {
      return res.status(400).send('Sesi login Google tidak valid atau kedaluwarsa. Silakan ulangi dari aplikasi.');
    }
    oauthStates.delete(state);

    const clientId = getClientId();
    const clientSecret = getClientSecret();
    try {
      const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: resolveCallbackUrl(req),
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.id_token) {
        console.error('Google OAuth token exchange failed:', tokenData);
        const detail = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
        return res.status(401).send(`Gagal menukar kode login Google (${detail}).`);
      }
      const profile = await verifyGoogleCredential(tokenData.id_token, { clientId, fetchImpl });
      const session = issueSessionForProfile(stateDb, profile, req, res, false);
      pruneExpired(appAuthCodes);
      const exchangeCode = crypto.randomBytes(24).toString('hex');
      appAuthCodes.set(exchangeCode, { payload: session, expiresAt: Date.now() + 2 * 60 * 1000 });
      const deepLink = `maktabah://auth?code=${encodeURIComponent(exchangeCode)}`;
      res.set('Cache-Control', 'no-store').send(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kembali ke Maktabah Turats</title></head><body style="font-family:sans-serif;text-align:center;padding:40px 20px;"><h2>Login Berhasil</h2><p>Mengembalikan Anda ke aplikasi Maktabah Turats…</p><p><a href="${deepLink}" style="display:inline-block;padding:12px 24px;background:#166534;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;">Buka Aplikasi</a></p><script>window.location.replace(${JSON.stringify(deepLink)});</script></body></html>`
      );
    } catch (e) {
      res.status(e.status || 400).send(e.message || 'Login Google gagal.');
    }
  });

  app.post('/api/auth/app-exchange', (req, res) => {
    const code = String(req.body?.code || '').trim();
    pruneExpired(appAuthCodes);
    const entry = code ? appAuthCodes.get(code) : null;
    if (!entry) return res.status(400).json({ error: 'Kode login aplikasi tidak valid atau kedaluwarsa.' });
    appAuthCodes.delete(code);
    if (entry.payload.adminToken) {
      setAdminActivityCookie(req, res, entry.payload.adminToken);
    }
    res.json({ success: true, ...entry.payload });
  });

  app.post('/api/auth/google', async (req, res) => {
    const stateDb = getStateDb();
    if (!stateDb) return res.status(503).json({ error: 'Database sesi belum siap.' });
    try {
      const profile = await verifyGoogleCredential(req.body?.credential, {
        clientId: getClientId(),
        fetchImpl,
      });
      const session = issueSessionForProfile(stateDb, profile, req, res, true);
      res.json({ success: true, ...session });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || 'Login Google gagal.' });
    }
  });

  app.get('/api/auth/me', requireUser, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ user: req.user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const stateDb = getStateDb();
    const token = extractBearer(req);
    if (stateDb && token) {
      try {
        stateDb.prepare('DELETE FROM user_tokens WHERE token = ?').run(token);
      } catch {}
    }
    const adminToken = typeof req.body?.adminToken === 'string' ? req.body.adminToken : '';
    if (adminToken) {
      activeTokens?.delete(adminToken);
      try {
        stateDb?.prepare('DELETE FROM admin_tokens WHERE token = ?').run(adminToken);
      } catch {}
      setAdminActivityCookie(req, res, '');
    }
    res.json({ success: true });
  });

  app.get('/api/user/opened-books', requireUser, (req, res) => {
    const stateDb = getStateDb();
    const rows = stateDb.prepare(
      `SELECT book_id AS bkid, title AS bk, author_name AS author, page_id AS pageId, part, page, last_opened_at AS timestamp
       FROM user_opened_books
       WHERE user_id = ?
       ORDER BY last_opened_at DESC
       LIMIT 50`
    ).all(req.user.id);
    res.json({ data: rows });
  });

  app.post('/api/user/opened-books', requireUser, (req, res) => {
    const stateDb = getStateDb();
    const incoming = Array.isArray(req.body?.books) ? req.body.books : [req.body];
    const upsert = stateDb.prepare(
      `INSERT INTO user_opened_books (user_id, book_id, title, author_name, page_id, part, page, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, book_id) DO UPDATE SET
         title = excluded.title,
         author_name = COALESCE(NULLIF(excluded.author_name, ''), user_opened_books.author_name),
         page_id = CASE WHEN excluded.page_id IS NOT NULL AND excluded.last_opened_at >= user_opened_books.last_opened_at THEN excluded.page_id ELSE COALESCE(user_opened_books.page_id, excluded.page_id) END,
         part = CASE WHEN excluded.page_id IS NOT NULL AND excluded.last_opened_at >= user_opened_books.last_opened_at THEN excluded.part ELSE COALESCE(user_opened_books.part, excluded.part) END,
         page = CASE WHEN excluded.page_id IS NOT NULL AND excluded.last_opened_at >= user_opened_books.last_opened_at THEN excluded.page ELSE COALESCE(user_opened_books.page, excluded.page) END,
         last_opened_at = MAX(user_opened_books.last_opened_at, excluded.last_opened_at)`
    );
    stateDb.transaction(() => {
      for (const b of incoming.slice(0, 50)) {
        const bookId = Number(b?.bkid ?? b?.book_id ?? b?.bookId);
        const title = String(b?.bk ?? b?.title ?? '').trim();
        if (!Number.isSafeInteger(bookId) || bookId < 1 || !title) continue;
        const author = String(b?.author ?? b?.author_name ?? '').trim();
        const rawPageId = b?.pageId ?? b?.page_id;
        const pageId = Number.isSafeInteger(Number(rawPageId)) && Number(rawPageId) >= 0 ? Number(rawPageId) : null;
        const part = b?.part !== undefined && b?.part !== null ? String(b.part) : null;
        const page = b?.page !== undefined && b?.page !== null ? String(b.page) : null;
        const ts = Number(b?.timestamp ?? b?.updatedAt ?? b?.last_opened_at) || Date.now();
        upsert.run(req.user.id, bookId, title, author, pageId, part, page, ts);
      }
    })();
    const rows = stateDb.prepare(
      `SELECT book_id AS bkid, title AS bk, author_name AS author, page_id AS pageId, part, page, last_opened_at AS timestamp
       FROM user_opened_books
       WHERE user_id = ?
       ORDER BY last_opened_at DESC
       LIMIT 50`
    ).all(req.user.id);
    res.json({ data: rows });
  });

  app.delete('/api/user/opened-books/:bookId', requireUser, (req, res) => {
    const stateDb = getStateDb();
    const bookId = Number(req.params.bookId);
    if (!Number.isSafeInteger(bookId) || bookId < 1) return res.status(400).json({ error: 'ID kitab tidak valid.' });
    stateDb.prepare('DELETE FROM user_opened_books WHERE user_id = ? AND book_id = ?').run(req.user.id, bookId);
    res.json({ success: true });
  });

  app.get('/api/user/activity', requireUser, (req, res) => {
    const stateDb = getStateDb();
    const uid = req.user.id;
    const email = req.user.email;
    const feedback = stateDb.prepare(
      'SELECT id, message, rating, created_at FROM feedback WHERE user_id = ? OR lower(email) = ? ORDER BY created_at DESC LIMIT 30'
    ).all(uid, email);
    const book_requests = stateDb.prepare(
      'SELECT id, book_title, book_author, status, created_at FROM book_requests WHERE user_id = ? OR lower(email) = ? ORDER BY created_at DESC LIMIT 30'
    ).all(uid, email);
    const book_submissions = stateDb.prepare(
      'SELECT id, book_title, book_author, file_name, status, created_at FROM book_submissions WHERE user_id = ? OR lower(email) = ? ORDER BY created_at DESC LIMIT 30'
    ).all(uid, email);
    res.json({ feedback, book_requests, book_submissions });
  });

  return { optionalUser, requireUser };
}
