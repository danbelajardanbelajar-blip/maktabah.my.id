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
      last_opened_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, book_id)
    );
  `);
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
  const getAdminEmails = () => parseAdminEmails(env.ADMIN_GOOGLE_EMAILS);

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
    res.set('Cache-Control', 'no-store').json({
      googleEnabled: Boolean(clientId),
      clientId: clientId || '',
    });
  });

  app.post('/api/auth/google', async (req, res) => {
    const stateDb = getStateDb();
    if (!stateDb) return res.status(503).json({ error: 'Database sesi belum siap.' });
    try {
      const profile = await verifyGoogleCredential(req.body?.credential, {
        clientId: getClientId(),
        fetchImpl,
      });
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
        setAdminActivityCookie(req, res, adminToken);
      }

      res.json({
        success: true,
        user,
        userToken,
        adminToken,
        redirectTo: isAdmin ? '#/admin' : '#/',
      });
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
      `SELECT book_id AS bkid, title AS bk, author_name AS author, last_opened_at AS timestamp
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
      `INSERT INTO user_opened_books (user_id, book_id, title, author_name, last_opened_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, book_id) DO UPDATE SET
         title = excluded.title,
         author_name = COALESCE(NULLIF(excluded.author_name, ''), user_opened_books.author_name),
         last_opened_at = MAX(user_opened_books.last_opened_at, excluded.last_opened_at)`
    );
    stateDb.transaction(() => {
      for (const b of incoming.slice(0, 50)) {
        const bookId = Number(b?.bkid ?? b?.book_id);
        const title = String(b?.bk ?? b?.title ?? '').trim();
        if (!Number.isSafeInteger(bookId) || bookId < 1 || !title) continue;
        const author = String(b?.author ?? b?.author_name ?? '').trim();
        const ts = Number(b?.timestamp ?? b?.last_opened_at) || Date.now();
        upsert.run(req.user.id, bookId, title, author, ts);
      }
    })();
    const rows = stateDb.prepare(
      `SELECT book_id AS bkid, title AS bk, author_name AS author, last_opened_at AS timestamp
       FROM user_opened_books
       WHERE user_id = ?
       ORDER BY last_opened_at DESC
       LIMIT 50`
    ).all(req.user.id);
    res.json({ data: rows });
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
