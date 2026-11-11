import fs from 'node:fs';
import path from 'node:path';
import { buildCategorySqlCase } from './known-categories.js';

export const MAX_TRANSFER_BYTES = 50 * 1024 * 1024;
const MAX_BOOKS = 100;
const MAX_CATEGORY_BOOKS = 5000;
const isCategory = payload => payload?.format === 'maktabah-categories';
const fail = message => { throw new Error(message); };
const integer = value => Number.isSafeInteger(value);
const nullableInt = value => value == null || integer(value);
const nullableText = value => value == null || typeof value === 'string';
// Legacy sources also use labels such as مقدمة for volume/page references.
export const validPageReference = value => nullableInt(value) || typeof value === 'string';
const historicalDate = value => nullableInt(value) || typeof value === 'string';

/** Validate a category metadata record for import/export. */
export const isValidCategoryMeta = c => Boolean(
  c && integer(c.id) && typeof c.name === 'string' && nullableInt(c.catord) && nullableInt(c.lvl)
);
/** Whether a book metadata record has a non-empty title string. */
export const hasBookTitle = b => typeof b?.bk === 'string' && b.bk.trim().length > 0;
/** Validate a book record's field types; allows NULL/empty titles so importers can skip legacy untitled rows. */
export const isValidBookRecord = b => Boolean(
  b && integer(b.bkid) && b.bkid >= 1 && nullableText(b.bk)
  && nullableInt(b.cat) && nullableInt(b.authno) && nullableText(b.inf) && nullableText(b.betaka)
);
/** Validate a book metadata record; requires a positive integer ID and non-empty title. */
export const isValidBookMeta = b => isValidBookRecord(b) && hasBookTitle(b);
/** Validate an author metadata record for import/export. */
export const isValidAuthorMeta = a => Boolean(
  a && integer(a.authid) && typeof a.auth === 'string' && nullableText(a.inf)
  && historicalDate(a.HigriD) && historicalDate(a.AD)
);
/** Validate a single page row belonging to `bookId`. */
export const isValidPageRow = (row, bookId) => Boolean(
  row && (row.id === null || integer(row.id)) && row.book_id === bookId
  && validPageReference(row.part) && validPageReference(row.page)
  && nullableText(row.seal) && (row.nass === null || typeof row.nass === 'string')
);
/** Validate a single table-of-contents title row belonging to `bookId`. */
export const isValidTitleRow = (row, bookId) => Boolean(
  row && (row.id === null || integer(row.id)) && row.book_id === bookId
  && nullableInt(row.lvl) && nullableInt(row.sub) && nullableText(row.tit)
);

/**
 * Resolve exportable book sources (`main` takes precedence over `tambahan`).
 * Category exports skip rows with invalid metadata (e.g. NULL/empty titles) so
 * one orphan row does not break an entire category package; explicit book
 * exports fail early if a requested book has missing or invalid metadata.
 */
export function resolveBookSources(db, { bookIds, categoryIds, includeAdditional = false }) {
  const byCat = categoryIds !== undefined;
  let candidateIds;
  if (byCat) {
    const wanted = new Set(categoryIds);
    candidateIds = [...new Set(
      db.prepare(`SELECT bkid,cat FROM ${bookCatalogueSql(includeAdditional)} ORDER BY bkid`)
        .all()
        .filter(b => wanted.has(b.cat))
        .map(b => b.bkid)
    )];
  } else {
    candidateIds = [...new Set(bookIds)];
  }
  const selectMain = db.prepare('SELECT bkid,bk,cat,authno,inf,betaka FROM main.books_meta WHERE bkid=?');
  const selectExtra = includeAdditional ? db.prepare('SELECT bkid,bk,cat,authno,inf,betaka FROM tambahan.books_meta WHERE bkid=?') : null;
  const sources = [];
  for (const bkid of candidateIds) {
    const mainBook = selectMain.get(bkid);
    const schema = mainBook ? 'main' : 'tambahan';
    const book = mainBook || selectExtra?.get(bkid);
    if (!book) fail(`Kitab ${bkid} tidak ditemukan di database utama.`);
    if (!isValidBookMeta(book)) {
      if (byCat) continue;
      fail(`Metadata kitab ${bkid} tidak valid.`);
    }
    sources.push({ bkid, schema, cat: book.cat });
  }
  return sources;
}

export const bookCatalogueSql = additional => additional
  ? '(SELECT bkid,bk,cat,authno,inf,betaka FROM main.books_meta UNION ALL SELECT bkid,bk,cat,authno,inf,betaka FROM tambahan.books_meta)'
  : 'main.books_meta';
export const categoryCatalogueSql = additional => additional
  ? `(SELECT id,name,catord,lvl FROM main.categories UNION ALL
      SELECT DISTINCT b.cat AS id, ${buildCategorySqlCase('b.cat')} AS name, 0 AS catord, 0 AS lvl
      FROM ${bookCatalogueSql(true)} b WHERE b.cat IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM main.categories c WHERE c.id=b.cat))`
  : 'main.categories';

export function validateBookPackage(payload) {
  const categoryPackage = isCategory(payload);
  if ((!categoryPackage && payload?.format !== 'maktabah-books') || payload.version !== 1 || !Array.isArray(payload.books)
    || payload.books.length < (categoryPackage ? 0 : 1) || payload.books.length > (categoryPackage ? MAX_CATEGORY_BOOKS : MAX_BOOKS)) {
    fail('File harus berupa export JSON kitab atau kategori Maktabah versi 1.');
  }
  const categoryIds = new Set();
  if (categoryPackage) {
    if (!Array.isArray(payload.categories) || !payload.categories.length || payload.categories.length > 100) fail('Paket harus berisi 1–100 kategori.');
    for (const c of payload.categories) {
      if (!isValidCategoryMeta(c) || categoryIds.has(c.id)) fail('Metadata kategori tidak valid atau ID berulang.');
      categoryIds.add(c.id);
    }
  }
  const ids = new Set();
  for (const item of payload.books) {
    const b = item?.book;
    if (!isValidBookRecord(b)) fail('Metadata kitab tidak valid.');
    if (ids.has(b.bkid)) fail(`ID kitab ${b.bkid} berulang dalam file.`);
    ids.add(b.bkid);
    if (b.cat != null && (!isValidCategoryMeta(item.category) || item.category.id !== b.cat)) fail(`Kategori kitab ${b.bkid} tidak valid.`);
    if (categoryPackage) {
      const c = payload.categories.find(c => c.id === b.cat);
      if (!c || ['id', 'name', 'catord', 'lvl'].some(key => c[key] !== item.category?.[key])) fail(`Kategori kitab ${b.bkid} tidak sesuai dengan paket kategori.`);
    }
    if (b.authno != null && (!isValidAuthorMeta(item.author) || item.author.authid !== b.authno)) fail(`Penulis kitab ${b.bkid} tidak valid.`);
    if (!Array.isArray(item.pages) || !Array.isArray(item.titles)) fail(`Halaman/daftar isi kitab ${b.bkid} tidak valid.`);
    for (const [rows, isPage] of [[item.pages, true], [item.titles, false]]) {
      const rowIds = new Set();
      for (const row of rows) {
        if (!row || (row.id !== null && !integer(row.id)) || row.book_id !== b.bkid || (row.id !== null && rowIds.has(row.id))) fail(`ID halaman/daftar isi kitab ${b.bkid} tidak valid atau berulang.`);
        if (row.id !== null) rowIds.add(row.id);
        if (!(isPage ? isValidPageRow(row, b.bkid) : isValidTitleRow(row, b.bkid))) fail(`Isi halaman/daftar isi kitab ${b.bkid} tidak valid.`);
      }
    }
  }
  return payload;
}

export function exportBooks(db, bookIds, maxBooks = MAX_BOOKS, includeAdditional = false) {
  if (!Array.isArray(bookIds) || !bookIds.length || bookIds.length > maxBooks
    || bookIds.some(id => !integer(id) || id < 1)) fail(`Paket melebihi batas ${maxBooks} kitab atau pilihan kitab tidak valid.`);
  const result = { format: 'maktabah-books', version: 1, exported_at: new Date().toISOString(), books: [] };
  let bytes = 0;
  for (const { bkid: id, schema } of resolveBookSources(db, { bookIds, includeAdditional })) {
    const book = db.prepare(`SELECT bkid,bk,cat,authno,inf,betaka FROM ${schema}.books_meta WHERE bkid=?`).get(id);
    const textBytes = db.prepare(`SELECT coalesce(sum(length(CAST(nass AS BLOB))),0) AS n FROM ${schema}.pages WHERE book_id=?`).get(id).n;
    if (textBytes > MAX_TRANSFER_BYTES) fail('Isi kitab terlalu besar. Batas export 50 MB per file.');
    const item = {
      book,
      category: book.cat == null ? null : db.prepare(`SELECT id,name,catord,lvl FROM ${categoryCatalogueSql(includeAdditional)} WHERE id=?`).get(book.cat) ?? null,
      author: book.authno == null ? null : db.prepare('SELECT authid,auth,inf,HigriD,AD FROM main.authors WHERE authid=?').get(book.authno) ?? null,
      pages: db.prepare(`SELECT id,book_id,part,page,seal,nass FROM ${schema}.pages WHERE book_id=? ORDER BY rowid`).all(id),
      titles: db.prepare(`SELECT id,book_id,lvl,sub,tit FROM ${schema}.titles WHERE book_id=? ORDER BY rowid`).all(id),
    };
    // Older catalogues may refer to a category or author that no longer exists.
    if (!item.category || !isValidCategoryMeta(item.category)) { item.category = null; item.book.cat = null; }
    if (!item.author || !isValidAuthorMeta(item.author)) { item.author = null; item.book.authno = null; }
    if (item.pages.some(row => !isValidPageRow(row, id))) fail(`Isi halaman kitab ${id} tidak valid.`);
    if (item.titles.some(row => !isValidTitleRow(row, id))) fail(`Daftar isi kitab ${id} tidak valid.`);
    bytes += Buffer.byteLength(JSON.stringify(item));
    if (bytes > MAX_TRANSFER_BYTES - 1024) fail('Export melebihi 50 MB. Pilih lebih sedikit kitab.');
    result.books.push(item);
  }
  return result;
}

export function exportCategories(db, categoryIds, includeAdditional = false) {
  if (!Array.isArray(categoryIds) || !categoryIds.length || categoryIds.length > 100 || categoryIds.some(id => !integer(id))) fail('Pilih 1–100 kategori untuk diexport.');
  const categories = [...new Set(categoryIds)].map(id => {
    const c = db.prepare(`SELECT id,name,catord,lvl FROM ${categoryCatalogueSql(includeAdditional)} WHERE id=?`).get(id);
    if (!c) fail(`Kategori ${id} tidak ditemukan.`);
    return c;
  });
  const ids = resolveBookSources(db, { categoryIds: categories.map(c => c.id), includeAdditional }).map(s => s.bkid);
  if (ids.length > MAX_CATEGORY_BOOKS) fail('Kategori pilihan melebihi 5.000 kitab. Pilih lebih sedikit kategori atau gunakan export per kitab.');
  const result = ids.length ? exportBooks(db, ids, MAX_CATEGORY_BOOKS, includeAdditional) : { version: 1, exported_at: new Date().toISOString(), books: [] };
  result.format = 'maktabah-categories';
  result.categories = categories;
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_TRANSFER_BYTES) fail('Kategori beserta isinya melebihi 50 MB. Pilih lebih sedikit kategori atau gunakan export per kitab.');
  return result;
}

export function importBooks(db, payload, existsInAdditional = () => false) {
  validateBookPackage(payload);
  return db.transaction(() => {
    let imported = 0, pages = 0, importedCategories = 0;
    const skipped = [];
    const categoryMap = new Map(), authorMap = new Map();
    const ensureCategory = c => {
      const key = JSON.stringify([c.id, c.name]);
      if (!categoryMap.has(key)) {
        const existing = db.prepare('SELECT id FROM main.categories WHERE name=? ORDER BY id LIMIT 1').get(c.name);
        const idAvailable = !db.prepare('SELECT 1 FROM main.categories WHERE id=?').get(c.id);
        if (!existing) importedCategories++;
        categoryMap.set(key, existing?.id ?? Number(db.prepare('INSERT INTO main.categories (id,name,catord,lvl) VALUES (?,?,?,?)').run(idAvailable ? c.id : null, c.name, c.catord ?? null, c.lvl ?? null).lastInsertRowid));
      }
      return categoryMap.get(key);
    };
    for (const c of isCategory(payload) ? payload.categories : []) ensureCategory(c);
    for (const item of payload.books) {
      const b = item.book;
      if (!hasBookTitle(b) || db.prepare('SELECT 1 FROM main.books_meta WHERE bkid=?').get(b.bkid) || existsInAdditional(b.bkid)) {
        skipped.push({ bkid: b.bkid, title: b.bk });
        continue;
      }
      let cat = null, authno = null;
      if (b.cat != null) {
        cat = ensureCategory(item.category);
      }
      if (b.authno != null) {
        const a = item.author;
        const key = JSON.stringify([a.authid, a.auth, a.inf, a.HigriD, a.AD]);
        if (!authorMap.has(key)) {
          const existing = db.prepare('SELECT authid FROM main.authors WHERE auth=? AND inf IS ? AND HigriD IS ? AND AD IS ? LIMIT 1').get(a.auth, a.inf ?? null, a.HigriD ?? null, a.AD ?? null);
          const idAvailable = !db.prepare('SELECT 1 FROM main.authors WHERE authid=?').get(a.authid);
          authorMap.set(key, existing?.authid ?? Number(db.prepare('INSERT INTO main.authors (authid,auth,inf,HigriD,AD) VALUES (?,?,?,?,?)').run(idAvailable ? a.authid : null, a.auth, a.inf ?? null, a.HigriD ?? null, a.AD ?? null).lastInsertRowid));
        }
        authno = authorMap.get(key);
      }
      db.prepare('INSERT INTO main.books_meta (bkid,bk,cat,authno,inf,betaka) VALUES (?,?,?,?,?,?)').run(b.bkid, b.bk, cat, authno, b.inf ?? null, b.betaka ?? null);
      const insertPage = db.prepare('INSERT INTO main.pages (id,book_id,part,page,seal,nass) VALUES (?,?,?,?,?,?)');
      for (const p of item.pages) insertPage.run(p.id, b.bkid, p.part ?? null, p.page ?? null, p.seal ?? null, p.nass);
      const insertTitle = db.prepare('INSERT INTO main.titles (id,book_id,lvl,sub,tit) VALUES (?,?,?,?,?)');
      for (const t of item.titles) insertTitle.run(t.id, b.bkid, t.lvl ?? null, t.sub ?? null, t.tit ?? null);
      imported++;
      pages += item.pages.length;
    }
    return { imported, pages, skipped, importedCategories };
  })();
}

export function registerBookTransfer(app, { getDb, getDbPath, requireAdmin, hasAdditional, clearCache, runtime = { importing: false } }) {
  app.post('/api/admin/books/export', requireAdmin, (req, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
      const data = req.body.categoryIds !== undefined ? exportCategories(db, req.body.categoryIds, hasAdditional()) : exportBooks(db, req.body.bookIds, MAX_BOOKS, hasAdditional());
      res.attachment(`maktabah-${isCategory(data) ? 'kategori' : 'kitab'}-${new Date().toISOString().slice(0, 10)}.json`).json(data);
    } catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.post('/api/admin/books/import', requireAdmin, async (req, res) => {
    if (runtime.importing) return res.status(409).json({ error: 'Import lain sedang berjalan. Tunggu hingga selesai.' });
    let backup = null;
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
      if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_TRANSFER_BYTES) return res.status(413).json({ error: 'Batas file import adalah 50 MB.' });
      validateBookPackage(req.body);
      runtime.importing = true;
      const directory = path.join(path.dirname(path.resolve(getDbPath())), 'book-import-backups');
      fs.mkdirSync(directory, { recursive: true });
      const required = fs.statSync(getDbPath()).size + Buffer.byteLength(JSON.stringify(req.body)) * 4 + MAX_TRANSFER_BYTES;
      const disk = fs.statfsSync(directory);
      if (disk.bavail * disk.bsize < required) throw new Error('Ruang disk tidak cukup untuk cadangan dan import.');
      backup = `before-import-${Date.now()}.db`;
      await db.backup(path.join(directory, backup));
      const result = importBooks(db, req.body, id => hasAdditional() && !!db.prepare('SELECT 1 FROM tambahan.books_meta WHERE bkid=?').get(id));
      clearCache();
      res.json({ success: true, ...result, backup });
    } catch (error) { res.status(400).json({ error: error.message, backup }); }
    finally { runtime.importing = false; }
  });
}
