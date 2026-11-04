import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const sourceDbPath = "D:\\database_maktabah_golden\\maktabah.db";
const targetDbPath = "D:\\database_maktabah_golden\\maktabah_mini.db";

if (fs.existsSync(targetDbPath)) {
  fs.unlinkSync(targetDbPath);
}

const sourceDb = new Database(sourceDbPath, { readonly: true });
const targetDb = new Database(targetDbPath);

console.log("Extracting schema...");
const schemas = sourceDb.prepare(`SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL AND name NOT LIKE '%fts%' AND name NOT LIKE 'sqlite_%'`).all();
for (const row of schemas) {
  targetDb.exec(row.sql);
}

// Ensure FTS tables are created if not present
try {
  targetDb.exec(`
    CREATE VIRTUAL TABLE pages_fts USING fts5(text, tokenize='unicode61');
    CREATE VIRTUAL TABLE rowa_fts USING fts5(Name, ROTBA, R_ZAHBI, tokenize='unicode61');
  `);
} catch (e) {
  console.log(e.message);
}

const insertRow = (tableName, row) => {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  targetDb.prepare(sql).run(...Object.values(row));
};

const bookIdsToCopy = [10, 11, 15, 20, 25]; // Choose 5 books

console.log(`Copying books_meta for books: ${bookIdsToCopy.join(', ')}...`);
const books = sourceDb.prepare(`SELECT * FROM books_meta WHERE bkid IN (${bookIdsToCopy.map(() => '?').join(',')})`).all(...bookIdsToCopy);
targetDb.transaction(() => {
  for (const b of books) insertRow('books_meta', b);
})();

console.log("Copying categories...");
const categories = sourceDb.prepare(`SELECT * FROM categories`).all();
targetDb.transaction(() => {
  for (const c of categories) insertRow('categories', c);
})();

console.log("Copying authors...");
const authors = sourceDb.prepare(`SELECT * FROM authors`).all();
targetDb.transaction(() => {
  for (const a of authors) insertRow('authors', a);
})();

console.log("Copying titles...");
const titles = sourceDb.prepare(`SELECT * FROM titles WHERE book_id IN (${bookIdsToCopy.map(() => '?').join(',')})`).all(...bookIdsToCopy);
targetDb.transaction(() => {
  for (const t of titles) insertRow('titles', t);
})();

console.log("Copying pages...");
const pages = sourceDb.prepare(`SELECT * FROM pages WHERE book_id IN (${bookIdsToCopy.map(() => '?').join(',')})`).all(...bookIdsToCopy);
targetDb.transaction(() => {
  for (const p of pages) {
    insertRow('pages', p);
  }
})();

console.log("Copying quran data...");
const surahs = sourceDb.prepare(`SELECT * FROM quran_surah`).all();
targetDb.transaction(() => {
  for (const s of surahs) insertRow('quran_surah', s);
})();

const ayahs = sourceDb.prepare(`SELECT * FROM quran_ayah`).all();
targetDb.transaction(() => {
  for (const a of ayahs) insertRow('quran_ayah', a);
})();

console.log("Copying rowa data...");
const rowa = sourceDb.prepare(`SELECT * FROM rowa`).all();
targetDb.transaction(() => {
  for (const r of rowa) {
    insertRow('rowa', r);
  }
})();

console.log("Done! maktabah_mini.db is ready.");
