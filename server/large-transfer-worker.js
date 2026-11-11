import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { categoryCatalogueSql, importBooks, resolveBookSources, isValidCategoryMeta, isValidAuthorMeta, isValidPageRow, isValidTitleRow } from './book-transfer.js';

const RESERVE = 256 * 1024 * 1024;
const fields = {
  categories: ['id', 'name', 'catord', 'lvl'], authors: ['authid', 'auth', 'inf', 'HigriD', 'AD'],
  books_meta: ['bkid', 'bk', 'cat', 'authno', 'inf', 'betaka'],
  pages: ['id', 'book_id', 'part', 'page', 'seal', 'nass'], titles: ['id', 'book_id', 'lvl', 'sub', 'tit'],
};
const schema = `CREATE TABLE transfer_manifest (data TEXT NOT NULL);
CREATE TABLE categories (id INTEGER PRIMARY KEY,name TEXT,catord INTEGER,lvl INTEGER);
CREATE TABLE authors (authid INTEGER PRIMARY KEY,auth TEXT,inf TEXT,HigriD INTEGER,AD INTEGER);
CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER,authno INTEGER,inf TEXT,betaka TEXT);
CREATE TABLE pages (id INTEGER,book_id INTEGER,part INTEGER,page INTEGER,seal TEXT,nass TEXT,PRIMARY KEY(book_id,id));
CREATE TABLE titles (id INTEGER,book_id INTEGER,lvl INTEGER,sub INTEGER,tit TEXT,PRIMARY KEY(book_id,id));`;
const reader = filename => {
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  db.pragma('query_only=ON'); db.pragma('trusted_schema=OFF'); db.pragma('cache_size=-8192');
  return db;
};
const insertRow = (db, table) => db.prepare(`INSERT INTO ${table} (${fields[table].join(',')}) VALUES (${fields[table].map(() => '?').join(',')})`);
const values = (row, table) => fields[table].map(key => row[key] ?? null);
function checkDisk(filename, needed = RESERVE) {
  const disk = fs.statfsSync(path.dirname(filename));
  if (disk.bavail * disk.bsize < needed) throw new Error('Ruang disk tidak cukup untuk melanjutkan transfer.');
}
function metadata(db, id, schema, categories) {
  const book = db.prepare(`SELECT bkid,bk,cat,authno,inf,betaka FROM ${schema}.books_meta WHERE bkid=?`).get(id);
  if (!book) throw new Error(`Kitab ${id} tidak ditemukan.`);
  let category = categories.get(book.cat) ?? null;
  let author = book.authno == null ? null : db.prepare('SELECT authid,auth,inf,HigriD,AD FROM main.authors WHERE authid=?').get(book.authno) ?? null;
  if (!category || !isValidCategoryMeta(category)) { category = null; book.cat = null; }
  if (!author || !isValidAuthorMeta(author)) { author = null; book.authno = null; }
  return { source: schema, book, category, author };
}

export function exportLargePackage(options, progress = () => {}) {
  const source = reader(options.dbPath);
  let output, created = false;
  try {
    const additional = Boolean(options.additionalPath && fs.existsSync(options.additionalPath));
    if (additional) source.prepare('ATTACH DATABASE ? AS tambahan').run(options.additionalPath);
    const categories = new Map(source.prepare(`SELECT * FROM ${categoryCatalogueSql(additional)}`).all().map(c => [c.id, c]));
    const byCategory = options.selection.categoryIds !== undefined;
    const selected = byCategory ? options.selection.categoryIds : options.selection.bookIds;
    if (!Array.isArray(selected) || !selected.length || selected.length > 50000 || selected.some(id => !Number.isSafeInteger(id))) throw new Error('Pilihan kitab/kategori tidak valid.');
    if (byCategory) for (const id of selected) if (!categories.has(id)) throw new Error(`Kategori ${id} tidak ditemukan.`);
    const items = resolveBookSources(source, { ...(byCategory ? { categoryIds: selected } : { bookIds: selected }), includeAdditional: additional });
    let totalPages = 0;
    for (const item of items) totalPages += source.prepare(`SELECT count(*) n FROM ${item.schema}.pages WHERE book_id=?`).get(item.bkid).n;
    checkDisk(options.outputPath);
    if (fs.existsSync(options.outputPath)) throw new Error('File export sudah ada.');
    output = new Database(options.outputPath);
    created = true;
    output.pragma('cache_size=-8192'); output.exec(schema);
    const insertBook = insertRow(output, 'books_meta'), insertPage = insertRow(output, 'pages'), insertTitle = insertRow(output, 'titles');
    const insertCategory = output.prepare('INSERT OR IGNORE INTO categories VALUES (?,?,?,?)');
    const insertAuthor = output.prepare('INSERT OR IGNORE INTO authors VALUES (?,?,?,?,?)');
    if (byCategory) for (const id of new Set(selected)) insertCategory.run(...values(categories.get(id), 'categories'));
    let booksDone = 0, pagesDone = 0, titlesDone = 0, lastProgress = 0;
    for (const reference of items) {
      const item = metadata(source, reference.bkid, reference.schema, categories);
      output.transaction(() => {
        if (item.category) insertCategory.run(...values(item.category, 'categories'));
        if (item.author) insertAuthor.run(...values(item.author, 'authors'));
        insertBook.run(...values(item.book, 'books_meta'));
        for (const row of source.prepare(`SELECT id,book_id,part,page,seal,nass FROM ${item.source}.pages WHERE book_id=?`).iterate(item.book.bkid)) {
          if (!isValidPageRow(row, item.book.bkid)) throw new Error(`Halaman kitab ${item.book.bkid} tidak valid (ID halaman ${row.id}).`);
          insertPage.run(...values(row, 'pages')); pagesDone++;
          if (Date.now() - lastProgress > 500) { checkDisk(options.outputPath); progress({ phase: 'export', totalBooks: items.length, booksDone, totalPages, pagesDone }); lastProgress = Date.now(); }
        }
        for (const row of source.prepare(`SELECT id,book_id,lvl,sub,tit FROM ${item.source}.titles WHERE book_id=?`).iterate(item.book.bkid)) {
          if (!isValidTitleRow(row, item.book.bkid)) throw new Error(`Daftar isi kitab ${item.book.bkid} tidak valid.`);
          insertTitle.run(...values(row, 'titles')); titlesDone++;
        }
      })();
      booksDone++;
    }
    const manifest = { format: 'maktabah-sqlite-package', version: 1, kind: byCategory ? 'categories' : 'books', exportedAt: new Date().toISOString(), books: booksDone, pages: pagesDone, titles: titlesDone };
    output.prepare('INSERT INTO transfer_manifest VALUES (?)').run(JSON.stringify(manifest));
    output.close(); output = null;
    progress({ phase: 'export', totalBooks: items.length, booksDone, totalPages, pagesDone });
    return { ...manifest, bytes: fs.statSync(options.outputPath).size };
  } catch (error) {
    output?.close(); output = null;
    if (created && fs.existsSync(options.outputPath)) fs.unlinkSync(options.outputPath);
    throw error;
  } finally { output?.close(); source.close(); }
}

export function inspectLargePackage(filename) {
  const db = reader(filename);
  try {
    for (const table of ['transfer_manifest', ...Object.keys(fields)]) {
      const item = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(table);
      if (!item || item.type !== 'table' || !/^CREATE TABLE\b/i.test(item.sql)) throw new Error('File bukan paket kitab Maktabah yang didukung.');
    }
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' LIMIT 1").get()) throw new Error('Paket transfer tidak boleh memuat trigger.');
    const manifest = JSON.parse(db.prepare('SELECT data FROM transfer_manifest').get()?.data || '{}');
    if (manifest.format !== 'maktabah-sqlite-package' || manifest.version !== 1 || !['books', 'categories'].includes(manifest.kind)) throw new Error('Format paket database tidak didukung. Gunakan hasil export mode file besar.');
    const counts = {};
    for (const table of Object.keys(fields)) {
      db.prepare(`SELECT ${fields[table].join(',')} FROM ${table} LIMIT 1`).get();
      counts[table] = db.prepare(`SELECT count(*) n FROM ${table}`).get().n;
    }
    if (counts.books_meta !== manifest.books || counts.pages !== manifest.pages || counts.titles !== manifest.titles) throw new Error('Jumlah isi paket tidak cocok; file mungkin belum selesai diunduh.');
    if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Pemeriksaan integritas paket gagal.');
    for (const table of ['pages', 'titles']) if (db.prepare(`SELECT 1 FROM ${table} p WHERE NOT EXISTS(SELECT 1 FROM books_meta b WHERE b.bkid=p.book_id) LIMIT 1`).get()) throw new Error('Paket berisi halaman tanpa kitab.');
    return { ...manifest, bytes: fs.statSync(filename).size, categories: db.prepare('SELECT * FROM categories ORDER BY name').all(), previewBooks: db.prepare('SELECT bkid,bk FROM books_meta ORDER BY bkid LIMIT 30').all() };
  } finally { db.close(); }
}

export async function importLargePackage(options, progress = () => {}) {
  progress({ phase: 'validate' });
  const info = inspectLargePackage(options.inputPath);
  const source = reader(options.inputPath);
  const destination = new Database(options.dbPath, { fileMustExist: true });
  let additional;
  try {
    destination.pragma('cache_size=-16384'); destination.pragma('busy_timeout=10000');
    if (destination.pragma('journal_mode=WAL', { simple: true }) !== 'wal') throw new Error('Mode database untuk import latar belakang tidak tersedia.');
    checkDisk(options.dbPath, fs.statSync(options.dbPath).size + info.bytes * 4 + RESERVE);
    if (options.additionalPath && fs.existsSync(options.additionalPath)) additional = reader(options.additionalPath);
    fs.mkdirSync(path.dirname(options.backupPath), { recursive: true });
    progress({ phase: 'backup' }); await destination.backup(options.backupPath);
    const categories = source.prepare('SELECT * FROM categories').all();
    let imported = 0, skipped = 0, importedCategories = 0, pagesDone = 0, booksDone = 0, lastProgress = 0;
    destination.transaction(() => {
      // Import categories in batches, retaining the version-1 metadata validation.
      for (let i = 0; i < categories.length; i += 100) importedCategories += importBooks(destination, { format: 'maktabah-categories', version: 1, categories: categories.slice(i, i + 100), books: [] }).importedCategories;
      const insertPage = insertRow(destination, 'pages'), insertTitle = insertRow(destination, 'titles');
      for (const book of source.prepare('SELECT bkid,bk,cat,authno,inf,betaka FROM books_meta ORDER BY bkid').iterate()) {
        const item = { book, category: book.cat == null ? null : source.prepare('SELECT * FROM categories WHERE id=?').get(book.cat), author: book.authno == null ? null : source.prepare('SELECT * FROM authors WHERE authid=?').get(book.authno), pages: [], titles: [] };
        const result = importBooks(destination, { format: 'maktabah-books', version: 1, books: [item] }, id => !!additional?.prepare('SELECT 1 FROM books_meta WHERE bkid=?').get(id));
        if (result.imported) {
          imported++;
          for (const p of source.prepare('SELECT id,book_id,part,page,seal,nass FROM pages WHERE book_id=?').iterate(book.bkid)) {
            if (!isValidPageRow(p, book.bkid)) throw new Error(`Halaman kitab ${book.bkid} tidak valid (ID halaman ${p.id}).`);
            insertPage.run(...values(p, 'pages')); pagesDone++;
            if (Date.now() - lastProgress > 500) { checkDisk(options.dbPath); progress({ phase: 'import', totalBooks: info.books, booksDone, totalPages: info.pages, pagesDone }); lastProgress = Date.now(); }
          }
          for (const t of source.prepare('SELECT id,book_id,lvl,sub,tit FROM titles WHERE book_id=?').iterate(book.bkid)) {
            if (!isValidTitleRow(t, book.bkid)) throw new Error(`Daftar isi kitab ${book.bkid} tidak valid.`);
            insertTitle.run(...values(t, 'titles'));
          }
        } else skipped++;
        booksDone++;
        progress({ phase: 'import', totalBooks: info.books, booksDone, totalPages: info.pages, pagesDone });
      }
    })();
    return { imported, skipped, importedCategories, pages: pagesDone, backup: path.basename(options.backupPath) };
  } finally { additional?.close(); source.close(); destination.close(); }
}

if (parentPort && workerData) {
  try {
    const progress = data => parentPort.postMessage({ type: 'progress', data });
    const result = workerData.action === 'export' ? exportLargePackage(workerData, progress)
      : workerData.action === 'inspect' ? inspectLargePackage(workerData.inputPath)
      : await importLargePackage(workerData, progress);
    parentPort.postMessage({ type: 'done', result });
  } catch (error) { parentPort.postMessage({ type: 'failed', error: error.message }); }
}
