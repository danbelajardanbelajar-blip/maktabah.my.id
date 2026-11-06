import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';

const error = (message, status = 400) => Object.assign(new Error(message), { status });
const validId = (id, zero = false) => Number.isSafeInteger(id) && id >= (zero ? 0 : 1);
const validCategoryIds = ids => Array.isArray(ids) && ids.length > 0 && ids.length <= 1000 && ids.every(id => validId(id, true));
const parseId = (value, zero = false) => {
  if (!/^\d+$/.test(value) || !validId(Number(value), zero)) throw error('ID tidak valid.');
  return Number(value);
};

// Only known book-owned records are removed; shared authors and files are retained.
const relations = {
  titles: ['book_id'], book_pdf: ['bkid'], book_shorts: ['bk'], user_comments: ['bk'],
  matn_sharh_books: ['matn', 'sharh'], matn_sharh_pages: ['matn', 'sharh'],
  tafsir_mapping: ['tafsir_bkid'], tafsir_ayah_mapping: ['tafsir_bkid'],
};

export function deleteCatalogue(db, { bookIds, categoryId, categoryIds, hasAdditional = false, hasTafsir = false, jobId }, progress = () => {}) {
  if (categoryIds !== undefined) {
    if (!validCategoryIds(categoryIds)) throw error('Pilih 1–1000 kategori yang valid.');
    if (jobId) db.exec('CREATE TABLE IF NOT EXISTS catalogue_deletion_receipts (id TEXT PRIMARY KEY, result TEXT NOT NULL)');
    return db.transaction(() => {
      const ids = [...new Set(categoryIds)];
      let totalBooks = 0;
      for (let offset = 0; offset < ids.length; offset += 500) {
        const batch = ids.slice(offset, offset + 500);
        totalBooks += db.prepare(`SELECT count(*) n FROM main.books_meta WHERE cat IN (${batch.map(() => '?').join(',')})`).get(...batch).n;
      }
      const total = { books: 0, pages: 0, titles: 0, related: 0, categories: 0 };
      for (const id of ids) {
        const deleted = deleteCatalogue(db, { categoryId: id, hasAdditional, hasTafsir }, p => progress({ totalBooks, booksDone: total.books + p.booksDone, pagesDone: total.pages + p.pagesDone }));
        for (const key of Object.keys(total)) total[key] += deleted[key];
      }
      if (jobId) db.prepare('INSERT INTO main.catalogue_deletion_receipts VALUES (?,?)').run(jobId, JSON.stringify(total));
      return total;
    }).immediate();
  }
  if (categoryId !== undefined ? !validId(categoryId, true)
    : !Array.isArray(bookIds) || !bookIds.length || bookIds.length > 50000 || bookIds.some(id => !validId(id))) {
    throw error('Pilihan kitab/kategori tidak valid.');
  }
  if (jobId) db.exec('CREATE TABLE IF NOT EXISTS catalogue_deletion_receipts (id TEXT PRIMARY KEY, result TEXT NOT NULL)');
  return db.transaction(() => {
    if (categoryId !== undefined && !db.prepare('SELECT 1 FROM main.categories WHERE id=?').get(categoryId)) throw error('Kategori tidak ditemukan.', 404);
    const ids = categoryId !== undefined
      ? db.prepare('SELECT bkid FROM main.books_meta WHERE cat=?').all(categoryId).map(b => b.bkid)
      : [...new Set(bookIds)];
    if (hasAdditional && (categoryId !== undefined
      ? db.prepare('SELECT 1 FROM tambahan.books_meta WHERE cat=? LIMIT 1').get(categoryId)
      : ids.some(id => db.prepare('SELECT 1 FROM tambahan.books_meta WHERE bkid=?').get(id)))) {
      throw error('Pilihan memuat kitab dari database sumber tambahan yang hanya dapat dibaca.', 409);
    }
    const total = { books: 0, pages: 0, titles: 0, related: 0, categories: 0 };
    const tables = new Set(db.prepare("SELECT name FROM main.sqlite_master WHERE type='table'").all().map(t => t.name));
    // FTS must be synchronized by the database trigger, in this same transaction.
    if (ids.length && tables.has('pages_fts') && !db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='trigger' AND tbl_name='pages' AND lower(sql) LIKE '%after delete%' AND lower(sql) LIKE '%pages_fts%'").get()) {
      throw error('Trigger indeks pencarian tidak tersedia; penghapusan dibatalkan.', 409);
    }
    progress({ totalBooks: ids.length, booksDone: 0, pagesDone: 0 });
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50), marks = batch.map(() => '?').join(',');
      for (const [table, columns] of Object.entries(relations)) {
        if (!tables.has(table)) continue;
        const deleted = db.prepare(`DELETE FROM main.${table} WHERE ${columns.map(c => `${c} IN (${marks})`).join(' OR ')}`).run(...columns.flatMap(() => batch)).changes;
        total[table === 'titles' ? 'titles' : 'related'] += deleted;
      }
      if (hasTafsir) {
        for (const table of ['tafsir_mapping', 'tafsir_ayah_mapping']) {
          if (db.prepare("SELECT 1 FROM tafsir.sqlite_master WHERE type='table' AND name=?").get(table)) {
            total.related += db.prepare(`DELETE FROM tafsir.${table} WHERE tafsir_bkid IN (${marks})`).run(...batch).changes;
          }
        }
      }
      total.pages += db.prepare(`DELETE FROM main.pages WHERE book_id IN (${marks})`).run(...batch).changes;
      total.books += db.prepare(`DELETE FROM main.books_meta WHERE bkid IN (${marks})`).run(...batch).changes;
      progress({ totalBooks: ids.length, booksDone: Math.min(offset + batch.length, ids.length), pagesDone: total.pages });
    }
    if (categoryId !== undefined) {
      for (const table of ['book_requests', 'book_submissions']) {
        if (tables.has(table)) db.prepare(`UPDATE main.${table} SET category_id=NULL WHERE category_id=?`).run(categoryId);
      }
      total.categories = db.prepare('DELETE FROM main.categories WHERE id=?').run(categoryId).changes;
    }
    else if (!total.books) throw error('Kitab tidak ditemukan.', 404);
    if (jobId) db.prepare('INSERT INTO main.catalogue_deletion_receipts VALUES (?,?)').run(jobId, JSON.stringify(total));
    return total;
  }).immediate();
}

export function registerBookDeletion(app, { getDb, requireAdmin, clearCache, hasAdditional, hasTafsir, runtime = {}, directory, getTafsirPath }) {
  const db = getDb();
  const folder = directory || path.join(path.dirname(db?.name || '.'), 'deletion-jobs');
  fs.mkdirSync(folder, { recursive: true });
  const jobs = new Map();
  const persist = job => {
    const filename = path.join(folder, `${job.id}.json`);
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(job));
    fs.renameSync(`${filename}.tmp`, filename);
  };
  const receipt = id => {
    if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE name='catalogue_deletion_receipts'").get()) return null;
    const row = db.prepare('SELECT result FROM main.catalogue_deletion_receipts WHERE id=?').get(id);
    return row ? JSON.parse(row.result) : null;
  };
  for (const file of fs.readdirSync(folder).filter(n => /^[a-f0-9]{48}\.json$/.test(n))) {
    let job;
    try { job = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')); } catch { continue; }
    if (file !== `${job.id}.json`) continue;
    if (job.status === 'running') {
      const result = receipt(job.id);
      Object.assign(job, result ? { status: 'done', deleted: result } : { status: 'failed', error: 'Server dimulai ulang. Penghapusan yang belum selesai dibatalkan.' });
      persist(job);
    }
    jobs.set(job.id, job);
  }
  app.get('/api/admin/deletion-jobs/:id', requireAdmin, (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Status penghapusan tidak ditemukan.' });
    res.set('Cache-Control', 'no-store').json(job);
  });
  const handle = selection => (req, res) => {
    if (!getDb()) return res.status(503).json({ error: 'Database belum tersedia.' });
    if (runtime.importing || runtime.deleting) return res.status(409).json({ error: 'Import atau penghapusan masih berjalan. Tunggu hingga selesai.' });
    let job;
    try {
      const options = selection(req);
      if (options.categoryIds !== undefined) {
        if (!validCategoryIds(options.categoryIds)) throw error('Pilih 1–1000 kategori yang valid.');
      } else if (options.categoryId === undefined && (!Array.isArray(options.bookIds) || !options.bookIds.length || options.bookIds.length > 50000 || options.bookIds.some(id => !validId(id)))) throw error('Pilihan kitab tidak valid.');
      job = { id: crypto.randomBytes(24).toString('hex'), status: 'running', progress: {}, createdAt: Date.now() };
      persist(job); jobs.set(job.id, job);
      runtime.deleting = true; db.pragma('busy_timeout=100');
      const tafsirPath = getTafsirPath?.() || db.pragma('database_list').find(d => d.name === 'tafsir')?.file;
      const worker = new Worker(new URL('./book-deletion-worker.js', import.meta.url), { workerData: {
        dbPath: db.name, tafsirPath: hasTafsir() ? tafsirPath : null,
        additionalPath: hasAdditional() ? db.pragma('database_list').find(d => d.name === 'tambahan')?.file : null,
        selection: options, jobId: job.id,
      } });
      let finished = false;
      const finish = (deleted, failure) => {
        if (finished) return;
        finished = true;
        const committed = deleted || receipt(job.id);
        Object.assign(job, committed ? { status: 'done', success: true, deleted: committed } : { status: 'failed', error: failure || 'Penghapusan dibatalkan.' });
        runtime.deleting = false; db.pragma('busy_timeout=5000'); clearCache(); persist(job);
      };
      worker.on('message', message => {
        if (message.progress) { job.progress = message.progress; }
        else finish(message.deleted, message.error);
      });
      worker.on('error', e => finish(null, e.message));
      worker.on('exit', () => { if (!finished) finish(null, 'Proses penghapusan berhenti sebelum selesai.'); });
      res.status(202).json(job);
    } catch (e) {
      if (job) { job.status = 'failed'; job.error = e.message; persist(job); runtime.deleting = false; db.pragma('busy_timeout=5000'); }
      res.status(e.status || 500).json({ error: e.message });
    }
  };
  app.delete('/api/admin/books/bulk-delete', requireAdmin, handle(req => ({ bookIds: req.body?.bookIds })));
  app.delete('/api/admin/categories/bulk-delete', requireAdmin, handle(req => ({ categoryIds: req.body?.categoryIds ?? [] })));
  app.delete('/api/admin/category/:id', requireAdmin, handle(req => ({ categoryId: parseId(req.params.id, true) })));
  app.delete('/api/admin/book/:id', requireAdmin, handle(req => ({ bookIds: [parseId(req.params.id)] })));
}
