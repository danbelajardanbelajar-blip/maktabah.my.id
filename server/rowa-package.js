import Database from 'better-sqlite3';
import fs from 'node:fs';
import {decodeWho} from './rowa-codes.js';

export const FORMAT = 'maktabah-rowa';
export const VERSION = 1;
export const MAX_PACKAGE = 128 * 1024 * 1024;
export const TEXT_FIELDS = ['Name','A_esm','A_kona','A_nasab','IsoName','CODE','WHO','TABAQA','AQUAL','ROTBA','R_ZAHBI','sheok','telmez','birth','death','ArrName','DispName'];
const norm = s => String(s || '').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/gu, '').trim();
export function createRowaSchema(db) {
  db.exec(`CREATE TABLE rowa_manifest(format TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,source TEXT NOT NULL,source_sha256 TEXT NOT NULL,row_count INTEGER NOT NULL);
    CREATE TABLE rowa(id INTEGER PRIMARY KEY,${TEXT_FIELDS.map(k => `"${k}" TEXT NOT NULL DEFAULT ''`).join(',')});
    CREATE TABLE men_detail(SpID INTEGER PRIMARY KEY,ManId INTEGER NOT NULL,Bk INTEGER,Id INTEGER,Talween TEXT);
    CREATE VIRTUAL TABLE rowa_fts USING fts5(Name,IsoName);`);
}
export function writeRowaRows(db, rows) {
  const insert = db.prepare(`INSERT INTO rowa(id,${TEXT_FIELDS.join(',')}) VALUES(${Array(TEXT_FIELDS.length+1).fill('?').join(',')})`);
  const fts = db.prepare('INSERT INTO rowa_fts(rowid,Name,IsoName) VALUES(?,?,?)');
  for(const row of rows) {
    if(!Number.isSafeInteger(row.id) || row.id < 1) throw new Error('ID perawi tidak valid.');
    const values = TEXT_FIELDS.map(k => {
      const v = row[k] ?? '';
      if(typeof v !== 'string' || v.length > 2_000_000) throw new Error(`Kolom ${k} tidak valid pada perawi ${row.id}.`);
      return v;
    });
    if(!values[0].trim() && !row.IsoName?.trim() && !row.A_esm?.trim()) throw new Error(`Nama perawi ${row.id} kosong.`);
    insert.run(row.id,...values);
    fts.run(row.id,norm(row.Name || row.A_esm),norm(row.IsoName));
  }
}
export function summarizeRowa(db) {
  const counts = db.prepare(`SELECT count(*) narrators,sum(trim(AQUAL)!='') biographies,sum(trim(WHO)!='') withBookCodes FROM rowa`).get();
  const unknown = new Set();
  for(const r of db.prepare('SELECT WHO FROM rowa').iterate()) for(const s of decodeWho(r.WHO).unknown) unknown.add(s);
  return {...counts, unknownSymbols:[...unknown].sort()};
}
// Never attach an uploaded database or execute its schema. Copy only validated values
// into a fresh database, rebuilding the FTS index from names.
export function canonicalizeRowaPackage(inputPath, outputPath) {
  if(fs.statSync(inputPath).size > MAX_PACKAGE) throw new Error('Paket perawi melebihi 128 MB.');
  let source, destination;
  try {
    source = new Database(inputPath,{readonly:true,fileMustExist:true});
    source.pragma('trusted_schema=OFF'); source.pragma('query_only=ON');
    if(source.pragma('quick_check',{simple:true}) !== 'ok') throw new Error('Database perawi rusak.');
    const schema = source.prepare("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
    const allowed = new Set(['rowa_manifest','rowa','men_detail','rowa_fts','rowa_fts_data','rowa_fts_idx','rowa_fts_content','rowa_fts_docsize','rowa_fts_config']);
    if(schema.some(s => !allowed.has(s.name) || !['table','index'].includes(s.type))) throw new Error('Paket memuat tabel, view, atau trigger yang tidak diizinkan.');
    for(const table of ['rowa_manifest','rowa','men_detail']) {
      const sql = source.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table)?.sql;
      if(!sql || /\bVIRTUAL\b/i.test(sql)) throw new Error('Tabel paket perawi tidak valid.');
    }
    const manifests = source.prepare('SELECT * FROM rowa_manifest').all();
    const m = manifests[0];
    if(manifests.length !== 1 || m.format !== FORMAT || m.version !== VERSION || !Number.isSafeInteger(m.row_count) || m.row_count < 1 || m.row_count > 100_000
      || typeof m.source !== 'string' || m.source.length > 500 || !/^\d{4}-\d{2}-\d{2}T/.test(m.created_at) || !/^[a-f0-9]{64}$/.test(m.source_sha256)) throw new Error('Format atau versi paket perawi tidak didukung.');
    const total = source.prepare('SELECT count(*) n FROM rowa').get().n;
    if(total !== m.row_count) throw new Error('Jumlah perawi tidak sesuai manifest.');
    if(source.prepare('SELECT count(*) n FROM men_detail').get().n > 200_000) throw new Error('Relasi sumber terlalu banyak.');
    if(fs.existsSync(outputPath)) throw new Error('Tujuan paket sudah ada.');
    destination = new Database(outputPath);
    createRowaSchema(destination);
    destination.transaction(() => {
      writeRowaRows(destination,source.prepare(`SELECT id,${TEXT_FIELDS.join(',')} FROM rowa ORDER BY id`).iterate());
      const ref = destination.prepare('INSERT INTO men_detail VALUES(?,?,?,?,?)');
      for(const r of source.prepare('SELECT SpID,ManId,Bk,Id,Talween FROM men_detail').iterate()) {
        if(!Number.isSafeInteger(r.SpID) || !Number.isSafeInteger(r.ManId) || !destination.prepare('SELECT 1 FROM rowa WHERE id=?').get(r.ManId)
          || ![r.Bk,r.Id].every(v=>v===null||Number.isSafeInteger(v)) || !(r.Talween===null || typeof r.Talween==='string' && r.Talween.length<=2_000_000)) throw new Error('Relasi sumber tidak valid.');
        ref.run(r.SpID,r.ManId,r.Bk,r.Id,r.Talween);
      }
      destination.prepare('INSERT INTO rowa_manifest VALUES(?,?,?,?,?,?)').run(m.format,m.version,m.created_at,m.source,m.source_sha256,m.row_count);
    })();
    const result = {manifest:m,...summarizeRowa(destination)};
    destination.close(); destination = null;
    return result;
  } catch(error) {
    if(destination?.open) destination.close();
    if(destination) fs.rmSync(outputPath,{force:true});
    throw error;
  } finally {source?.close();}
}
