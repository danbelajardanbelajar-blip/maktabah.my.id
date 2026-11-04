const ADODB = require('node-adodb');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function migrateQuran() {
  const sqliteDbPath = "D:\\database_maktabah_golden\\maktabah.db";
  const mdbPath = "D:\\Maktabah Syamilah Golden\\Files\\special.mdb";

  console.log('Connecting to special.mdb...');
  const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${mdbPath};`);
  const db = new Database(sqliteDbPath);

  try {
    console.log('Creating tables...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS quran_surah (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS quran_ayah (
        id INTEGER PRIMARY KEY,
        surah_id INTEGER NOT NULL,
        ayah_no INTEGER NOT NULL,
        text TEXT NOT NULL,
        page INTEGER,
        FOREIGN KEY (surah_id) REFERENCES quran_surah(id)
      );
    `);

    // Migrate Surahs
    console.log('Querying Sora table from MDB...');
    const surahs = await connection.query('SELECT * FROM Sora');
    
    const insertSurah = db.prepare('INSERT OR REPLACE INTO quran_surah (id, name) VALUES (?, ?)');
    const insertAyah = db.prepare('INSERT OR REPLACE INTO quran_ayah (id, surah_id, ayah_no, text, page) VALUES (?, ?, ?, ?, ?)');

    db.transaction(() => {
      console.log(`Migrating ${surahs.length} surahs...`);
      for (const s of surahs) {
        insertSurah.run(s.id, s.sora);
      }
    })();

    // Migrate Ayahs
    console.log('Querying Qr table from MDB...');
    const ayahs = await connection.query('SELECT * FROM Qr');
    
    db.transaction(() => {
      console.log(`Migrating ${ayahs.length} ayahs...`);
      for (const a of ayahs) {
        insertAyah.run(a.Id, a.sora, a.aya, a.nass, a.Page);
      }
    })();

    console.log('Quran migration completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    db.close();
  }
}

migrateQuran();
