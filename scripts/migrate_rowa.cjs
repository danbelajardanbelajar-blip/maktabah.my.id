const ADODB = require('node-adodb');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function migrateRowa() {
  const sqliteDbPath = "D:\\database_maktabah_golden\\maktabah.db";
  const mdbPath = "D:\\Maktabah Syamilah Golden\\Files\\special.mdb";

  console.log('Connecting to special.mdb...');
  const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${mdbPath};`);
  const db = new Database(sqliteDbPath);

  try {
    console.log('Creating tables...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS rowa (
        id INTEGER PRIMARY KEY,
        Name TEXT,
        A_esm TEXT,
        A_kona TEXT,
        A_nasab TEXT,
        ROTBA TEXT,
        R_ZAHBI TEXT,
        birth TEXT,
        death TEXT,
        sheok TEXT,
        telmez TEXT,
        IsoName TEXT
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS rowa_fts USING fts5(
        Name,
        IsoName,
        A_nasab,
        content='rowa',
        content_rowid='id'
      );
    `);

    // Migrate Rowa
    console.log('Querying rowa table from MDB (this may take a moment)...');
    const rowas = await connection.query('SELECT * FROM rowa');
    
    const insertRowa = db.prepare(`
      INSERT OR REPLACE INTO rowa (id, Name, A_esm, A_kona, A_nasab, ROTBA, R_ZAHBI, birth, death, sheok, telmez, IsoName) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFts = db.prepare(`
      INSERT OR REPLACE INTO rowa_fts (rowid, Name, IsoName, A_nasab) VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      console.log(`Migrating ${rowas.length} rowas...`);
      for (const r of rowas) {
        insertRowa.run(
          r.id, 
          r.Name || '', 
          r.A_esm || '', 
          r.A_kona || '', 
          r.A_nasab || '', 
          r.ROTBA || '', 
          r.R_ZAHBI || '', 
          r.birth || '', 
          r.death || '', 
          r.sheok || '', 
          r.telmez || '', 
          r.IsoName || ''
        );
        insertFts.run(r.id, r.Name || '', r.IsoName || '', r.A_nasab || '');
      }
    })();

    console.log('Rowa migration completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    db.close();
  }
}

migrateRowa();
