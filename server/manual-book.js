import { bookCatalogueSql, categoryCatalogueSql } from './book-transfer.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function resolveCategory(db, catId, additional) {
  const id = Number(catId);
  if (!Number.isSafeInteger(id) || id < 0) throw fail('Kategori tidak valid.');
  const mainCat = db.prepare('SELECT id, name, catord, lvl FROM main.categories WHERE id = ?').get(id);
  if (mainCat) return mainCat.id;
  if (additional) {
    const extraCat = db.prepare(`SELECT id, name, catord, lvl FROM ${categoryCatalogueSql(true)} WHERE id = ?`).get(id);
    if (extraCat) {
      db.prepare('INSERT INTO main.categories (id, name, catord, lvl) VALUES (?, ?, ?, ?)').run(
        extraCat.id,
        extraCat.name,
        extraCat.catord ?? null,
        extraCat.lvl ?? null
      );
      return extraCat.id;
    }
  }
  throw fail('Kategori tidak ditemukan.', 404);
}

function resolveAuthor(db, rawAuthor) {
  const name = String(rawAuthor || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!name) return null;
  const existing = db.prepare('SELECT authid FROM main.authors WHERE auth = ? ORDER BY authid LIMIT 1').get(name);
  if (existing) return existing.authid;
  const nextId = (db.prepare('SELECT MAX(authid) AS n FROM main.authors').get()?.n || 0) + 1;
  db.prepare('INSERT INTO main.authors (authid, auth, inf, HigriD, AD) VALUES (?, ?, NULL, NULL, NULL)').run(nextId, name);
  return nextId;
}

export function createManualBook(db, input = {}, { hasAdditional = false } = {}) {
  const title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!title) throw fail('Judul kitab wajib diisi.');
  const inf = input.inf != null && String(input.inf).trim() ? String(input.inf).trim().slice(0, 4000) : null;
  const initialNass = typeof input.initialNass === 'string' ? input.initialNass.trim() : '';

  return db.transaction(() => {
    const cat = resolveCategory(db, input.catId, hasAdditional);
    const bkid = (db.prepare(`SELECT MAX(bkid) AS n FROM ${bookCatalogueSql(hasAdditional)}`).get()?.n || 0) + 1;
    const authno = resolveAuthor(db, input.author);

    db.prepare('INSERT INTO main.books_meta (bkid, bk, cat, authno, inf, betaka) VALUES (?, ?, ?, ?, ?, NULL)')
      .run(bkid, title, cat, authno, inf);

    let initialPageId = null;
    if (initialNass) {
      const part = input.initialPart !== undefined && input.initialPart !== '' ? input.initialPart : 1;
      const page = input.initialPage !== undefined && input.initialPage !== '' ? input.initialPage : 1;
      initialPageId = 1;
      db.prepare('INSERT INTO main.pages (id, book_id, part, page, seal, nass) VALUES (?, ?, ?, ?, NULL, ?)')
        .run(initialPageId, bkid, part, page, initialNass);
    }

    return { bkid, bk: title, cat, authno, inf, initialPageId };
  })();
}

export function createManualPage(db, rawBookId, input = {}) {
  const bookId = Number(rawBookId);
  if (!Number.isSafeInteger(bookId) || bookId <= 0) throw fail('ID kitab tidak valid.');
  const nass = typeof input.nass === 'string' ? input.nass.trim() : '';
  if (!nass) throw fail('Isi teks halaman wajib diisi.');

  return db.transaction(() => {
    const book = db.prepare('SELECT bkid FROM main.books_meta WHERE bkid = ?').get(bookId);
    if (!book) throw fail('Kitab tidak ditemukan di database utama.', 404);

    const stats = db.prepare('SELECT MAX(id) AS maxId, MAX(CAST(page AS INTEGER)) AS maxPage FROM main.pages WHERE book_id = ?').get(bookId);
    const id = (stats?.maxId || 0) + 1;
    const part = input.part !== undefined && input.part !== '' ? input.part : 1;
    const page = input.page !== undefined && input.page !== '' ? input.page : (stats?.maxPage || 0) + 1;

    db.prepare('INSERT INTO main.pages (id, book_id, part, page, seal, nass) VALUES (?, ?, ?, ?, NULL, ?)')
      .run(id, bookId, part, page, nass);

    return { id, book_id: bookId, part, page };
  })();
}

export function createManualCategory(db, input = {}, { hasAdditional = false } = {}) {
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!name) throw fail('Nama kategori wajib diisi.');

  return db.transaction(() => {
    const existing = db.prepare(`SELECT id FROM ${categoryCatalogueSql(hasAdditional)} WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1`).get(name);
    if (existing) throw fail(`Kategori "${name}" sudah ada.`, 409);

    const id = (db.prepare(`SELECT MAX(id) AS n FROM ${categoryCatalogueSql(hasAdditional)}`).get()?.n || 0) + 1;
    const catord = (db.prepare('SELECT MAX(catord) AS n FROM main.categories').get()?.n || 0) + 1;
    const lvl = 0;

    db.prepare('INSERT INTO main.categories (id, name, catord, lvl) VALUES (?, ?, ?, ?)').run(id, name, catord, lvl);
    return { id, name, catord, lvl, book_count: 0 };
  })();
}

export function registerManualBook(app, { getDb, getStateDb, requireAdmin, hasAdditional, invalidateCache, forgetPolicyBook, onBookCreated }) {
  app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
    try {
      const category = createManualCategory(db, req.body || {}, { hasAdditional: hasAdditional() });
      invalidateCache?.();
      res.status(201).json({ success: true, category });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/admin/books', requireAdmin, (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
    try {
      const book = createManualBook(db, req.body || {}, { hasAdditional: hasAdditional() });
      try { onBookCreated?.({ bookId: book.bkid, title: book.bk, authorName: req.body?.author, sourceRef: 'Tambah Kitab Manual' }); } catch { /* Non-fatal if author DB unavailable */ }
      invalidateCache?.();
      res.status(201).json({ success: true, book });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/admin/book/:id/pages', requireAdmin, (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
    try {
      const page = createManualPage(db, req.params.id, req.body || {});
      invalidateCache?.();
      forgetPolicyBook?.(getStateDb?.(), page.book_id);
      res.status(201).json({ success: true, page });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });
}
