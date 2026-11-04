const ADODB = require('node-adodb');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const booksDir = "D:\\Maktabah Syamilah Golden\\Books";
const dbPath = "D:\\database_maktabah_golden\\maktabah.db";

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Harap masukkan ID Kitab. Contoh: node scripts/convert_single.cjs 104331");
    process.exit(1);
}

const bookIdStr = args[0];
const mdbFile = path.join(booksDir, `${bookIdStr}.bok`);

if (!fs.existsSync(mdbFile)) {
    console.error(`File tidak ditemukan: ${mdbFile}`);
    process.exit(1);
}

const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${mdbFile};`);
const db = new Database(dbPath);

async function convertSingle() {
    console.log(`Mencoba konversi ulang Kitab ID: ${bookIdStr}...`);
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

        db.transaction((pagesList, titlesList) => {
          for (const page of pagesList) {
            insertPage.run({ 
              id: page.id || page.ID || 0, 
              part: page.part || page.Part || 0, 
              page: page.page || page.Page || 0, 
              seal: page.seal || page.Seal || '', 
              nass: page.nass || page.Nass || '', 
              book_id: parseInt(bookIdStr) 
            });
          }
          for (const title of titlesList) {
            insertTitle.run({ 
              id: title.id || title.ID || 0, 
              lvl: title.lvl || title.Lvl || 0, 
              sub: title.sub || title.Sub || 0, 
              tit: title.tit || title.Tit || '', 
              book_id: parseInt(bookIdStr) 
            });
          }
        })(pages, titles);

        console.log(`✅ Berhasil menyusulkan konversi Kitab ID: ${bookIdStr}!`);
    } catch (err) {
        console.error(`❌ Gagal konversi Kitab ID ${bookIdStr}. Error:`, err.message);
    } finally {
        db.close();
    }
}

convertSingle();
