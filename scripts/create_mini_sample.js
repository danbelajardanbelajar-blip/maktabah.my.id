import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || 'D:/db/new db/maktabah_gabungan.db');
const folder = path.resolve(process.argv[3] || path.join(root, 'dev-data'));
const mainPath = path.join(folder, 'maktabah.db');
const tafsirPath = path.join(folder, 'tafsir_relasi.db');
fs.mkdirSync(folder, { recursive: true });
for (const file of [mainPath, tafsirPath]) {
  if (fs.existsSync(file)) throw new Error(`Output already exists; choose a new output folder: ${file}`);
}
const src = new Database(source, { readonly: true, fileMustExist: true });
const sourceBefore = fs.statSync(source);
const schema = src.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const selected = new Map();
const profiles = new Map();
const mapped = new Set(src.prepare('SELECT DISTINCT tafsir_bkid FROM tafsir_ayah_mapping').all().map(r => r.tafsir_bkid));
const profile = id => {
  if (!profiles.has(id)) profiles.set(id, src.prepare(`SELECT count(*) AS pages, coalesce(sum(length(CAST(nass AS BLOB))),0) AS bytes,
    sum(id IS NULL) AS null_ids FROM (SELECT id,nass FROM pages WHERE book_id=? LIMIT 301)`).get(id));
  return profiles.get(id);
};
const choose = (book, maxBytes = 180000) => {
  const p = profile(book.bkid);
  if (p.pages >= 10 && p.pages <= 180 && p.bytes <= maxBytes && !p.null_ids) {
    selected.set(book.bkid, { ...book, pages: p.pages, text_bytes: p.bytes });
    return true;
  }
  return false;
};
for (const cat of [2, 1, 3, 4, 5, 7, 8, 10, 12, 13, 26, 39]) {
  const books = src.prepare(`SELECT b.* FROM books_meta b JOIN authors a ON a.authid=b.authno
    WHERE b.cat=? ORDER BY b.bkid LIMIT 60`).all(cat);
  if (cat === 2) books.sort((a,b) => Number(mapped.has(b.bkid))-Number(mapped.has(a.bkid)));
  for (const book of books) if (choose(book, cat === 2 && mapped.has(book.bkid) ? 350000 : 180000)) break;
}
if (selected.size < 5) throw new Error('Not enough suitable complete sample books in source');
const ids = [...selected.keys()];
const placeholders = ids.map(() => '?').join(',');
const db = new Database(mainPath);
db.pragma('journal_mode = DELETE');
const ordinary = schema.filter(r => r.type === 'table' && !r.name.startsWith('merge_') && !r.name.includes('_fts'));
for (const row of ordinary) db.exec(row.sql);
const copyRows = (target, table, rows) => {
  if (!rows.length) return 0;
  const keys = Object.keys(rows[0]);
  const stmt = target.prepare(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
  target.transaction(() => { for (const row of rows) stmt.run(...keys.map(k => row[k])); })();
  return rows.length;
};
copyRows(db, 'books_meta', src.prepare(`SELECT * FROM books_meta WHERE bkid IN (${placeholders})`).all(...ids));
copyRows(db, 'categories', src.prepare(`SELECT * FROM categories WHERE id IN (SELECT cat FROM books_meta WHERE bkid IN (${placeholders}))`).all(...ids));
copyRows(db, 'authors', src.prepare(`SELECT * FROM authors WHERE authid IN (SELECT authno FROM books_meta WHERE bkid IN (${placeholders}))`).all(...ids));
copyRows(db, 'pages', src.prepare(`SELECT rowid AS rowid,* FROM pages WHERE book_id IN (${placeholders}) ORDER BY rowid`).all(...ids));
copyRows(db, 'titles', src.prepare(`SELECT t.* FROM titles t WHERE book_id IN (${placeholders})
  AND EXISTS(SELECT 1 FROM pages p WHERE p.book_id=t.book_id AND p.id=t.id)`).all(...ids));
for (const table of ['quran_surah','quran_ayah']) copyRows(db, table, src.prepare(`SELECT * FROM ${table}`).all());
copyRows(db, 'rowa', src.prepare('SELECT * FROM rowa ORDER BY id LIMIT 100').all());
for (const table of ['book_shorts','external_links']) {
  const col = table === 'book_shorts' ? 'bk' : 'code';
  copyRows(db, table, src.prepare(`SELECT * FROM ${table} WHERE ${col} IN (${placeholders})`).all(...ids));
}
copyRows(db, 'matn_sharh_books', src.prepare(`SELECT * FROM matn_sharh_books WHERE matn IN (${placeholders}) AND sharh IN (${placeholders})`).all(...ids,...ids));
copyRows(db, 'matn_sharh_pages', src.prepare(`SELECT m.* FROM matn_sharh_pages m WHERE matn IN (${placeholders}) AND sharh IN (${placeholders})
 AND EXISTS(SELECT 1 FROM pages p WHERE p.book_id=m.matn AND p.id=m.matn_id)
 AND EXISTS(SELECT 1 FROM pages p WHERE p.book_id=m.sharh AND p.id=m.sharh_id)`).all(...ids,...ids));
const tafsir = new Database(tafsirPath);
for (const table of ['tafsir_mapping','tafsir_ayah_mapping']) {
  tafsir.exec(ordinary.find(r => r.name === table).sql);
  const rows = src.prepare(`SELECT m.* FROM ${table} m WHERE tafsir_bkid IN (${placeholders})
    AND EXISTS(SELECT 1 FROM pages p WHERE p.book_id=m.tafsir_bkid AND p.id=m.page_id)`).all(...ids);
  copyRows(db, table, rows); copyRows(tafsir, table, rows);
}
for (const row of schema.filter(r => r.type === 'index' && ordinary.some(t => t.name === r.tbl_name))) db.exec(row.sql);
for (const name of ['pages_fts','rowa_fts']) {
  db.exec(schema.find(r => r.name === name).sql);
  db.prepare(`INSERT INTO ${name}(${name}) VALUES('rebuild')`).run();
  db.prepare(`INSERT INTO ${name}(${name},rank) VALUES('integrity-check',1)`).run();
}
for (const row of schema.filter(r => r.type === 'trigger' && ['pages','rowa'].includes(r.tbl_name))) db.exec(row.sql);
if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Mini database integrity check failed');
if (tafsir.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Mini tafsir integrity check failed');
const counts = Object.fromEntries(['books_meta','categories','authors','pages','titles','quran_surah','quran_ayah','rowa','tafsir_ayah_mapping'].map(t => [t,db.prepare(`SELECT count(*) n FROM ${t}`).get().n]));
if (!db.prepare("SELECT rowid FROM pages_fts WHERE pages_fts MATCH 'الله' LIMIT 1").get()) throw new Error('Search sample failed');
db.close();tafsir.close();src.close();
const sourceAfter = fs.statSync(source);
if (sourceAfter.size !== sourceBefore.size || sourceAfter.mtimeMs !== sourceBefore.mtimeMs) throw new Error('Source metadata changed');
const result = { source, database: mainPath, bytes: fs.statSync(mainPath).size, tafsir_bytes: fs.statSync(tafsirPath).size,
  counts, books: [...selected.values()], checks: { sqlite_integrity: 'ok', fts_external_content_integrity: 'ok', source_unchanged: true },
  note: 'Development sample: complete selected books, all Quran verses, 100 narrators; unavailable PDF files and user data are excluded.' };
fs.writeFileSync(path.join(folder,'mini-db-info.json'), JSON.stringify(result,null,2));
console.log(JSON.stringify({database:mainPath,bytes:result.bytes,tafsir_bytes:result.tafsir_bytes,counts,checks:result.checks},null,2));
