import fs from 'node:fs';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';

export const AUTHOR_FORMAT='maktabah-authors';
export const AUTHOR_VERSION=1;
export const AUTHOR_MAX_BYTES=64*1024*1024;
export const normalizeIdentity=value=>String(value||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/gu,'').replace(/\s+/gu,' ').trim();
export const identityHash=value=>crypto.createHash('sha256').update(normalizeIdentity(value)).digest('hex');
export function matchAuthorIdentity(metadataAuthor,candidates) {
  const names=candidates.filter(a=>normalizeIdentity(a.name)===normalizeIdentity(metadataAuthor?.name));
  if(!metadataAuthor?.name?.trim()||metadataAuthor.ambiguousName||names.length!==1)return null;
  const year=s=>String(s||'').match(/\d{3,4}/)?.[0];
  const local=year(metadataAuthor.death_text),source=year(names[0].death_text);
  return local&&source&&local!==source?null:names[0];
}
export function authorSchema(db) {
  db.exec(`CREATE TABLE manifest(format TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,source TEXT NOT NULL,source_hash TEXT NOT NULL,authors INTEGER NOT NULL,works INTEGER NOT NULL);
    CREATE TABLE authors(id INTEGER PRIMARY KEY,name TEXT NOT NULL,biography TEXT NOT NULL,death_text TEXT NOT NULL,source_ref TEXT NOT NULL,name_key TEXT NOT NULL);
    CREATE INDEX authors_name ON authors(name_key);
    CREATE TABLE works(book_id INTEGER PRIMARY KEY,title TEXT NOT NULL,metadata_author TEXT NOT NULL,source_ref TEXT NOT NULL,title_key TEXT NOT NULL);
    CREATE INDEX works_title ON works(title_key);
    CREATE TABLE attributions(book_id INTEGER NOT NULL REFERENCES works(book_id),author_id INTEGER NOT NULL REFERENCES authors(id),basis TEXT NOT NULL,evidence TEXT NOT NULL,PRIMARY KEY(book_id,author_id));
    CREATE INDEX attributions_author ON attributions(author_id);
    CREATE TABLE decisions(book_id INTEGER NOT NULL REFERENCES works(book_id),author_id INTEGER NOT NULL REFERENCES authors(id),status TEXT NOT NULL CHECK(status IN ('confirmed','rejected')),note TEXT NOT NULL,updated_at TEXT NOT NULL,book_key TEXT NOT NULL,author_key TEXT NOT NULL,PRIMARY KEY(book_id,author_id));
    CREATE TABLE events(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,book_id INTEGER NOT NULL,author_id INTEGER NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL);
    PRAGMA user_version=1;`);
}
const fail=msg=>{throw new Error(msg);};
const integer=n=>Number.isSafeInteger(n)&&n>0;
const text=(s,max=2_000_000)=>typeof s==='string'&&s.length<=max;
export function authorStats(db) {
  return {authors:db.prepare('SELECT count(*) n FROM authors').get().n,
    biographies:db.prepare("SELECT count(*) n FROM authors WHERE trim(biography)!=''").get().n,
    works:db.prepare('SELECT count(*) n FROM works').get().n,
    matched:db.prepare('SELECT count(DISTINCT book_id) n FROM attributions').get().n,
    decisions:db.prepare('SELECT count(*) n FROM decisions').get().n};
}
export function inspectAuthorPackage(input,output) {
  if(fs.statSync(input).size>AUTHOR_MAX_BYTES)fail('Ukuran paket penulis maksimal 64 MB.');
  if(fs.existsSync(output))fail('File tujuan sudah ada.');
  let src,dst;
  try {
    src=new Database(input,{readonly:true,fileMustExist:true});src.pragma('trusted_schema=OFF');src.pragma('query_only=ON');
    const allowed=new Set(['manifest','authors','authors_name','works','works_title','attributions','attributions_author','decisions','events']);
    const schema=src.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
    if(schema.some(s=>!allowed.has(s.name)||!['table','index'].includes(s.type)||/\bVIRTUAL\b/i.test(s.sql||'')))fail('Skema paket penulis memuat objek yang tidak diizinkan.');
    if(src.pragma('quick_check',{simple:true})!=='ok')fail('Paket penulis rusak.');
    const manifests=src.prepare('SELECT * FROM manifest').all(),m=manifests[0];
    if(manifests.length!==1||m.format!==AUTHOR_FORMAT||m.version!==AUTHOR_VERSION||!integer(m.authors)||m.authors>50_000||!Number.isSafeInteger(m.works)||m.works<0||m.works>200_000||!text(m.source,1000)||!/^\d{4}-\d\d-\d\dT/.test(m.created_at)||!/^[a-f0-9]{64}$/.test(m.source_hash))fail('Manifest paket penulis tidak didukung.');
    if(src.prepare('SELECT count(*) n FROM authors').get().n!==m.authors||src.prepare('SELECT count(*) n FROM works').get().n!==m.works)fail('Jumlah data tidak sesuai manifest.');
    for(const t of ['attributions','decisions','events'])if(src.prepare(`SELECT count(*) n FROM ${t}`).get().n>400_000)fail('Relasi atau riwayat paket terlalu banyak.');
    dst=new Database(output);dst.pragma('foreign_keys=ON');authorSchema(dst);
    dst.transaction(()=>{
      const a=dst.prepare('INSERT INTO authors VALUES(?,?,?,?,?,?)'),w=dst.prepare('INSERT INTO works VALUES(?,?,?,?,?)');
      for(const r of src.prepare('SELECT * FROM authors').iterate()) {
        if(!integer(r.id)||!text(r.name,1000)||!r.name.trim()||!text(r.biography)||!text(r.death_text,500)||!text(r.source_ref,1000))fail('Data penulis tidak valid.');
        a.run(r.id,r.name,r.biography,r.death_text,r.source_ref,normalizeIdentity(r.name));
      }
      for(const r of src.prepare('SELECT * FROM works').iterate()) {
        if(!integer(r.book_id)||!text(r.title,5000)||!r.title.trim()||!text(r.metadata_author,2000)||!text(r.source_ref,1000))fail('Data kitab tidak valid.');
        w.run(r.book_id,r.title,r.metadata_author,r.source_ref,normalizeIdentity(r.title));
      }
      const at=dst.prepare('INSERT INTO attributions VALUES(?,?,?,?)');
      for(const r of src.prepare('SELECT * FROM attributions').iterate()) {
        if(!integer(r.book_id)||!integer(r.author_id)||!['source-explicit','metadata-exact'].includes(r.basis)||!text(r.evidence,10000))fail('Relasi penulis tidak valid.');
        at.run(r.book_id,r.author_id,r.basis,r.evidence);
      }
      const dec=dst.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?,?)');
      for(const r of src.prepare('SELECT * FROM decisions').iterate()) {
        const book=dst.prepare('SELECT title_key FROM works WHERE book_id=?').get(r.book_id),author=dst.prepare('SELECT name_key FROM authors WHERE id=?').get(r.author_id);
        if(!book||!author||!['confirmed','rejected'].includes(r.status)||!text(r.note,10000)||!r.note.trim()||!/^\d{4}-\d\d-\d\dT/.test(r.updated_at)||r.book_key!==identityHash(book.title_key)||r.author_key!==identityHash(author.name_key))fail('Keputusan tinjauan tidak sesuai identitas sumber.');
        dec.run(r.book_id,r.author_id,r.status,r.note,r.updated_at,r.book_key,r.author_key);
      }
      const event=dst.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)');
      for(const r of src.prepare('SELECT * FROM events').iterate()) {
        if(!/^[a-f0-9]{32}$/.test(r.id)||!/^\d{4}-\d\d-\d\dT/.test(r.created_at)||!integer(r.book_id)||!integer(r.author_id)||!['confirmed','rejected','reset','preserved-on-import'].includes(r.action)||!text(r.note,10000))fail('Riwayat tinjauan tidak valid.');
        event.run(r.id,r.created_at,r.book_id,r.author_id,r.action,r.note);
      }
      dst.prepare('INSERT INTO manifest VALUES(?,?,?,?,?,?,?)').run(m.format,m.version,m.created_at,m.source,m.source_hash,m.authors,m.works);
    })();
    const result={manifest:m,...authorStats(dst)};dst.close();dst=null;return result;
  }catch(e){if(dst?.open)dst.close();if(dst)fs.rmSync(output,{force:true});throw e;}
  finally{src?.close();}
}
