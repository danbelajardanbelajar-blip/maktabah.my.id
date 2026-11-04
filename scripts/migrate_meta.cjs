const ADODB = require('node-adodb');
const Database = require('better-sqlite3');
const path = require('path');

const mainMdb = `D:\\Maktabah Syamilah Golden\\Files\\main.mdb`;
const specialMdb = `D:\\Maktabah Syamilah Golden\\Files\\special.mdb`;
const dbPath = 'D:\\database_maktabah_golden\\maktabah.db';

const db = new Database(dbPath);

console.log("Menyiapkan skema SQLite untuk metadata...");

db.exec(`
  CREATE TABLE IF NOT EXISTS authors (
    authid INTEGER PRIMARY KEY,
    auth TEXT,
    inf TEXT,
    HigriD INTEGER,
    AD INTEGER
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT,
    catord INTEGER,
    lvl INTEGER
  );

  CREATE TABLE IF NOT EXISTS books_meta (
    bkid INTEGER PRIMARY KEY,
    bk TEXT,
    cat INTEGER,
    inf TEXT,
    authno INTEGER,
    betaka TEXT
  );

  CREATE TABLE IF NOT EXISTS matn_sharh_books (
    matn INTEGER,
    matn_ver INTEGER,
    sharh INTEGER,
    sharh_ver INTEGER,
    PRIMARY KEY (matn, sharh)
  );

  CREATE TABLE IF NOT EXISTS matn_sharh_pages (
    matn INTEGER,
    matn_id INTEGER,
    sharh INTEGER,
    sharh_id INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_matn_sharh_pages_matn ON matn_sharh_pages(matn, matn_id);

  CREATE TABLE IF NOT EXISTS book_pdf (
    bkid INTEGER,
    pdf_path TEXT,
    part INTEGER
  );

  CREATE TABLE IF NOT EXISTS book_shorts (
    bk INTEGER,
    ramz TEXT,
    nass TEXT
  );

  CREATE TABLE IF NOT EXISTS user_comments (
    id INTEGER,
    bk INTEGER,
    com TEXT
  );

  CREATE TABLE IF NOT EXISTS external_links (
    code INTEGER,
    link TEXT
  );
`);

async function migrate() {
  const mainConn = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${mainMdb};`);
  const specialConn = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${specialMdb};`);

  try {
    console.log("Migrasi Authors (special.mdb -> Auth)...");
    const authors = await specialConn.query(`SELECT authid, auth, inf, HigriD, AD FROM [Auth]`);
    const insertAuthor = db.prepare(`INSERT OR REPLACE INTO authors (authid, auth, inf, HigriD, AD) VALUES (@authid, @auth, @inf, @HigriD, @AD)`);
    db.transaction(() => {
      for (const a of authors) insertAuthor.run(a);
    })();
    console.log(`Berhasil migrasi ${authors.length} penulis.`);

    console.log("Migrasi Kategori (main.mdb -> 0cat)...");
    const categories = await mainConn.query(`SELECT id, name, catord, Lvl FROM [0cat]`);
    const insertCat = db.prepare(`INSERT OR REPLACE INTO categories (id, name, catord, lvl) VALUES (@id, @name, @catord, @Lvl)`);
    db.transaction(() => {
      for (const c of categories) insertCat.run(c);
    })();
    console.log(`Berhasil migrasi ${categories.length} kategori.`);

    console.log("Migrasi Kitab Metadata (main.mdb -> 0bok)...");
    const books = await mainConn.query(`SELECT bkid, bk, cat, inf, authno, betaka FROM [0bok]`);
    const insertBook = db.prepare(`INSERT OR REPLACE INTO books_meta (bkid, bk, cat, inf, authno, betaka) VALUES (@bkid, @bk, @cat, @inf, @authno, @betaka)`);
    db.transaction(() => {
      for (const b of books) {
        // Handle potential nulls
        insertBook.run({
          bkid: b.bkid, bk: b.bk, cat: b.cat || 0, inf: b.inf || '', authno: b.authno || 0, betaka: b.betaka || ''
        });
      }
    })();
    console.log(`Berhasil migrasi ${books.length} metadata kitab.`);

    console.log("Migrasi Relasi Matan-Syarah (special.mdb -> oShrooh)...");
    let oShrooh = [];
    try { oShrooh = await specialConn.query(`SELECT Matn, MatnVer, Sharh, SharhVer FROM [oShrooh]`); } catch(e) { console.log("Tabel oShrooh kosong/tidak ada."); }
    const insertShrooh = db.prepare(`INSERT OR IGNORE INTO matn_sharh_books (matn, matn_ver, sharh, sharh_ver) VALUES (@Matn, @MatnVer, @Sharh, @SharhVer)`);
    db.transaction(() => {
      for (const s of oShrooh) insertShrooh.run(s);
    })();
    console.log(`Berhasil migrasi ${oShrooh.length} relasi kitab Matan-Syarah.`);

    console.log("Migrasi Relasi Halaman Matan-Syarah (special.mdb -> oShr)...");
    let oShr = [];
    try { oShr = await specialConn.query(`SELECT Matn, MatnId, Sharh, SharhId FROM [oShr]`); } catch(e) { console.log("Tabel oShr kosong/tidak ada."); }
    const insertShr = db.prepare(`INSERT INTO matn_sharh_pages (matn, matn_id, sharh, sharh_id) VALUES (@Matn, @MatnId, @Sharh, @SharhId)`);
    db.transaction(() => {
      for (const s of oShr) insertShr.run(s);
    })();
    console.log(`Berhasil migrasi ${oShr.length} relasi halaman Matan-Syarah.`);

    console.log("Migrasi PDF Eksternal (special.mdb -> 0pdf)...");
    let pdfs = [];
    try { pdfs = await specialConn.query(`SELECT BkId, PdfPath, Part FROM [0pdf]`); } catch(e) {}
    const insertPdf = db.prepare(`INSERT INTO book_pdf (bkid, pdf_path, part) VALUES (@BkId, @PdfPath, @Part)`);
    db.transaction(() => { for (const s of pdfs) insertPdf.run(s); })();

    console.log("Migrasi Kamus Singkatan (special.mdb -> shorts)...");
    let shorts = [];
    try { shorts = await specialConn.query(`SELECT Bk, Ramz, Nass FROM [shorts]`); } catch(e) {}
    const insertShorts = db.prepare(`INSERT INTO book_shorts (bk, ramz, nass) VALUES (@Bk, @Ramz, @Nass)`);
    db.transaction(() => { for (const s of shorts) insertShorts.run(s); })();

    console.log("Migrasi Catatan Pengguna (special.mdb -> com)...");
    let coms = [];
    try { coms = await specialConn.query(`SELECT id, bk, com FROM [com]`); } catch(e) {}
    const insertCom = db.prepare(`INSERT INTO user_comments (id, bk, com) VALUES (@id, @bk, @com)`);
    db.transaction(() => { for (const s of coms) insertCom.run(s); })();

    console.log("Migrasi Link Eksternal (special.mdb -> link)...");
    let links = [];
    try { links = await specialConn.query(`SELECT code, link FROM [link]`); } catch(e) {}
    const insertLink = db.prepare(`INSERT INTO external_links (code, link) VALUES (@code, @link)`);
    db.transaction(() => { for (const s of links) insertLink.run(s); })();

    console.log("Migrasi Metadata Global Selesai!");

  } catch (err) {
    console.error("Gagal saat migrasi metadata:", err);
  } finally {
    db.close();
  }
}

migrate();
