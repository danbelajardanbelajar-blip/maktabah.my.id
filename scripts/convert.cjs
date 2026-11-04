const ADODB = require('node-adodb');
const Database = require('better-sqlite3');
const path = require('path');

const mdbPath = process.argv[2];
const dbPath = process.argv[3] || 'maktabah.db';

if (!mdbPath) {
  console.error("Usage: node convert.cjs <path_to_mdb> [path_to_sqlite]");
  process.exit(1);
}

// Extract Book ID from file name
const bookId = parseInt(path.basename(mdbPath, '.mdb'), 10);
if (isNaN(bookId)) {
  console.error("Could not parse book ID from file name.");
  process.exit(1);
}

console.log(`Starting conversion for Book ID ${bookId}...`);
const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${mdbPath};`);
const db = new Database(dbPath);

// Setup schema
db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER,
    part INTEGER,
    page INTEGER,
    seal TEXT,
    nass TEXT,
    book_id INTEGER,
    PRIMARY KEY (book_id, id)
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(nass, content='pages');

  CREATE TABLE IF NOT EXISTS titles (
    id INTEGER,
    lvl INTEGER,
    sub INTEGER,
    tit TEXT,
    book_id INTEGER,
    PRIMARY KEY (book_id, id)
  );

  -- Trigger untuk update FTS secara otomatis setiap ada buku masuk
  CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
    INSERT INTO pages_fts(rowid, nass) VALUES (new.rowid, new.nass);
  END;
`);

async function convert() {
  try {
    const pages = await connection.query(`SELECT * FROM [book]`);
    
    let titles = [];
    try {
        titles = await connection.query(`SELECT * FROM [title]`);
    } catch(e) {}

    const insertPage = db.prepare(`
      INSERT OR IGNORE INTO pages (id, part, page, seal, nass, book_id) 
      VALUES (@id, @part, @page, @seal, @nass, @book_id)
    `);
    
    const insertTitle = db.prepare(`
      INSERT OR IGNORE INTO titles (id, lvl, sub, tit, book_id)
      VALUES (@id, @lvl, @sub, @tit, @book_id)
    `);

    const insertMany = db.transaction((pagesList, titlesList) => {
      for (const page of pagesList) {
        insertPage.run({ 
          id: page.id || page.ID || 0, 
          part: page.part || page.Part || 0, 
          page: page.page || page.Page || 0, 
          seal: page.seal || page.Seal || '', 
          nass: page.nass || page.Nass || '', 
          book_id: bookId 
        });
      }
      for (const title of titlesList) {
        insertTitle.run({ 
          id: title.id || title.ID || 0, 
          lvl: title.lvl || title.Lvl || 0, 
          sub: title.sub || title.Sub || 0, 
          tit: title.tit || title.Tit || '', 
          book_id: bookId 
        });
      }
    });

    insertMany(pages, titles);
    
    console.log(`Successfully converted book ${bookId}!`);
  } catch (err) {
    console.error("Error during conversion:", err);
  } finally {
    db.close();
  }
}

convert();
