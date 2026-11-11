import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import Database from 'better-sqlite3';
import {categoryCatalogueSql,importBooks,validateBookPackage,resolveBookSources,hasBookTitle,isValidCategoryMeta,isValidAuthorMeta,isValidPageRow,isValidTitleRow} from './book-transfer.js';

export const MAGIC=Buffer.from('MAKTABAH-PARTS-1\n');
export const MAX_RAW=8*1024*1024,MAX_COMPRESSED=MAX_RAW+65536,RESERVE=512*1024*1024;
const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const integer=Number.isSafeInteger;
export function encodePart(id,sequence,records){
 const raw=Buffer.from(JSON.stringify({format:'maktabah-parts',version:1,id,sequence,records}));
 if(raw.length>MAX_RAW)fail('Satu halaman/metadata melebihi 8 MB. Gunakan mode .db untuk kitab tersebut.');
 const compressed=gzipSync(raw,{level:6});
 if(compressed.length>MAX_COMPRESSED)fail('Bagian terkompresi terlalu besar.');
 const header=Buffer.alloc(36);header.writeUInt32BE(compressed.length);Buffer.from(digest(compressed),'hex').copy(header,4);
 return {compressed,hash:digest(compressed),frame:Buffer.concat([header,compressed])};
}
export function decodePart(compressed,hash){
 if(!Buffer.isBuffer(compressed))compressed=Buffer.from(compressed);
 if(!compressed.length||compressed.length>MAX_COMPRESSED||!/^[a-f0-9]{64}$/.test(hash||'')||digest(compressed)!==hash)fail('Checksum bagian tidak cocok. Pilih kembali file asli.');
 let data;
 try{data=JSON.parse(gunzipSync(compressed,{maxOutputLength:MAX_RAW}).toString('utf8'));}catch{fail('Bagian rusak atau hasil dekompresi melebihi 8 MB.');}
 if(data?.format!=='maktabah-parts'||data.version!==1||!/^[a-f0-9]{48}$/.test(data.id)||!integer(data.sequence)||data.sequence<0||!Array.isArray(data.records)||data.records.length>50000)fail('Format bagian tidak valid.');
 return data;
}
function diskBudget(filename,needed=RESERVE){
 const d=fs.statfsSync(path.dirname(path.resolve(filename)));
 if(d.bavail*d.bsize<needed)fail('Ruang disk untuk bagian berikutnya tidak cukup. Import dijeda; lanjutkan setelah tersedia ruang.',507);
}
export function exportCompact({dbPath,additionalPath,selection,outputPath,targetBytes=1024*1024},progress=()=>{}){
 const db=new Database(dbPath,{readonly:true,fileMustExist:true});let fd;
 try{
  db.pragma('query_only=ON');db.pragma('cache_size=-8192');
  const extra=!!(additionalPath&&fs.existsSync(additionalPath));
  if(extra)db.prepare('ATTACH DATABASE ? AS tambahan').run(additionalPath);
  db.exec('BEGIN');
  const categories=new Map(db.prepare(`SELECT * FROM ${categoryCatalogueSql(extra)}`).all().map(c=>[c.id,c]));
  const byCat=selection?.categoryIds!==undefined,chosen=byCat?selection.categoryIds:selection?.bookIds;
  if(!Array.isArray(chosen)||!chosen.length||chosen.length>(byCat?100:50000)||chosen.some(id=>!integer(id)||id<(byCat?0:1)))fail('Pilihan export tidak valid.');
  const wanted=new Set(chosen);
  if(byCat)for(const id of wanted)if(!categories.has(id))fail('Kategori tidak ditemukan.');
  const sources=resolveBookSources(db,{...(byCat?{categoryIds:chosen}:{bookIds:chosen}),includeAdditional:extra});
  const ids=sources.map(b=>b.bkid);
  const usedCats=byCat?new Set(chosen):new Set(sources.map(b=>b.cat).filter(id=>categories.has(id)));
  const id=crypto.randomBytes(24).toString('hex');
  let pages=0,titles=0;
  for(const b of sources){pages+=db.prepare(`SELECT count(*) n FROM ${b.schema}.pages WHERE book_id=?`).get(b.bkid).n;titles+=db.prepare(`SELECT count(*) n FROM ${b.schema}.titles WHERE book_id=?`).get(b.bkid).n;}
  const manifest={kind:byCat?'categories':'books',books:ids.length,pages,titles,categories:[...usedCats].map(id=>categories.get(id)),exportedAt:new Date().toISOString()};
  diskBudget(outputPath);fd=fs.openSync(outputPath,'wx');fs.writeSync(fd,MAGIC);
  let sequence=0,records=[],size=0,booksDone=0,pagesDone=0;
  const flush=()=>{if(!records.length)return;diskBudget(outputPath);const part=encodePart(id,sequence++,records);fs.writeSync(fd,part.frame);records=[];size=0;progress({booksDone,totalBooks:ids.length,pagesDone,totalPages:pages,parts:sequence});};
  const emit=record=>{const bytes=Buffer.byteLength(JSON.stringify(record));if(bytes>MAX_RAW-1024)fail('Satu halaman/metadata melebihi batas bagian 8 MB. Gunakan mode .db untuk kitab tersebut.');if(records.length&&(size+bytes>Math.min(targetBytes,MAX_RAW-2048)||records.length>=10000))flush();records.push(record);size+=bytes+1;};
  emit({type:'manifest',manifest});flush();
  for(const b of sources){
   const book=db.prepare(`SELECT bkid,bk,cat,authno,inf,betaka FROM ${b.schema}.books_meta WHERE bkid=?`).get(b.bkid);
   let category=categories.get(book.cat)||null;
   let author=book.authno==null?null:db.prepare('SELECT authid,auth,inf,HigriD,AD FROM main.authors WHERE authid=?').get(book.authno)||null;
   if(!category||!isValidCategoryMeta(category)){category=null;book.cat=null;}if(!author||!isValidAuthorMeta(author)){author=null;book.authno=null;}
   const counts={pages:db.prepare(`SELECT count(*) n FROM ${b.schema}.pages WHERE book_id=?`).get(b.bkid).n,titles:db.prepare(`SELECT count(*) n FROM ${b.schema}.titles WHERE book_id=?`).get(b.bkid).n};
   emit({type:'book',item:{book,category,author,pages:[],titles:[]},counts});
   for(const row of db.prepare(`SELECT id,book_id,part,page,seal,nass FROM ${b.schema}.pages WHERE book_id=? ORDER BY rowid`).iterate(b.bkid)){if(!isValidPageRow(row,b.bkid))fail(`Isi halaman kitab ${b.bkid} tidak valid.`);emit({type:'page',row});pagesDone++;}
   for(const row of db.prepare(`SELECT id,book_id,lvl,sub,tit FROM ${b.schema}.titles WHERE book_id=? ORDER BY rowid`).iterate(b.bkid)){if(!isValidTitleRow(row,b.bkid))fail(`Daftar isi kitab ${b.bkid} tidak valid.`);emit({type:'title',row});}
   emit({type:'book_end',bookId:b.bkid});booksDone++;
  }
  flush();emit({type:'end',books:ids.length,pages,titles});flush();
  fs.closeSync(fd);fd=undefined;db.exec('COMMIT');
  return {id,manifest,parts:sequence,bytes:fs.statSync(outputPath).size};
 }catch(e){if(fd!==undefined){fs.closeSync(fd);fs.rmSync(outputPath,{force:true});}throw e;}finally{db.close();}
}
export function ensureCompactSchema(db){
 db.exec(`CREATE TABLE IF NOT EXISTS compact_sessions(id TEXT PRIMARY KEY,status TEXT NOT NULL,next INTEGER NOT NULL,total INTEGER NOT NULL,manifest TEXT NOT NULL,current TEXT,stats TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS compact_receipts(session TEXT,sequence INTEGER,hash TEXT NOT NULL,PRIMARY KEY(session,sequence));
 CREATE TABLE IF NOT EXISTS compact_books(session TEXT,book_id INTEGER,PRIMARY KEY(session,book_id));`);
}
export function compactStatus(db,id){
 const s=db.prepare('SELECT * FROM compact_sessions WHERE id=?').get(id);
 return s?{id:s.id,status:s.status,next:s.next,total:s.total,manifest:JSON.parse(s.manifest),stats:JSON.parse(s.stats),pendingBook:JSON.parse(s.current||'null')?.item?.book?.bk||null}:null;
}
export function activeCompact(db){return db.prepare("SELECT id FROM compact_sessions WHERE status IN ('paused','cancelling') LIMIT 1").get()?.id||null;}
export function startCompact(db,part,hash,total){
 if(part.sequence!==0||part.records.length!==1||part.records[0]?.type!=='manifest'||!integer(total)||total<2||total>1000000)fail('Manifest paket tidak valid.');
 const m=part.records[0].manifest;
 if(!plain(m)||!['categories','books'].includes(m.kind)||['books','pages','titles'].some(k=>!integer(m[k])||m[k]<0)||!Array.isArray(m.categories)||m.categories.length>100)fail('Isi manifest tidak valid.');
 if(m.categories.length)validateBookPackage({format:'maktabah-categories',version:1,categories:m.categories,books:[]});
 return db.transaction(()=>{
  const existing=compactStatus(db,part.id);
  if(existing){const receipt=db.prepare('SELECT hash FROM compact_receipts WHERE session=? AND sequence=0').get(part.id);if(existing.total!==total||receipt?.hash!==hash)fail('File berbeda dengan sesi tersimpan.',409);if(existing.status==='cancelled')fail('Sesi ini sudah dibatalkan. Export ulang paket untuk memulai sesi baru.',409);return existing;}
  if(activeCompact(db))fail('Masih ada import bertahap yang perlu dilanjutkan atau diakhiri.',409);
  for(const table of ['pages','titles'])if(db.prepare(`PRAGMA foreign_key_list(${table})`).all().length)fail('Skema database ini belum mendukung import bertahap.',409);
  const fts=db.prepare("SELECT 1 FROM sqlite_master WHERE name='pages_fts'").get();
  if(fts)for(const action of ['insert','delete'])if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND tbl_name='pages' AND lower(sql) LIKE ? AND lower(sql) LIKE '%pages_fts%'").get('%after '+action+'%'))fail('Trigger pencarian tidak lengkap; import dibatalkan.',409);
  const stats={imported:0,skipped:0,pages:0,booksDone:0,processedPages:0,processedTitles:0,importedCategories:0};
  if(m.categories.length)stats.importedCategories=importBooks(db,{format:'maktabah-categories',version:1,categories:m.categories,books:[]}).importedCategories;
  db.prepare('INSERT INTO compact_sessions VALUES (?,?,?,?,?,?,?,?)').run(part.id,'paused',1,total,JSON.stringify(m),null,JSON.stringify(stats),Date.now());
  db.prepare('INSERT INTO compact_receipts VALUES (?,?,?)').run(part.id,0,hash);
  return compactStatus(db,part.id);
 }).immediate();
}
export function applyCompact(db,part,hash,existsAdditional=()=>false){
 const s=db.prepare('SELECT * FROM compact_sessions WHERE id=?').get(part.id);
 if(!s)fail('Sesi import tidak ditemukan.',404);
 const receipt=db.prepare('SELECT hash FROM compact_receipts WHERE session=? AND sequence=?').get(part.id,part.sequence);
 if(receipt){if(receipt.hash!==hash)fail('Bagian berbeda dari yang sudah disimpan.',409);return compactStatus(db,part.id);}
 if(s.status!=='paused'||s.next!==part.sequence||part.sequence>=s.total)fail('Urutan bagian tidak cocok. Muat status dan lanjutkan dari bagian terakhir.',409);
 const manifest=JSON.parse(s.manifest),stats=JSON.parse(s.stats);let current=JSON.parse(s.current||'null'),status='paused';
 return db.transaction(()=>{
  for(const record of part.records){
   if(!plain(record))fail('Rekaman bagian tidak valid.');
   if(record.type==='book'){
    if(current)fail('Kitab sebelumnya belum lengkap.');
    validateBookPackage({format:'maktabah-books',version:1,books:[record.item]});
    if(record.item.pages.length||record.item.titles.length||!plain(record.counts)||['pages','titles'].some(k=>!integer(record.counts[k])||record.counts[k]<0))fail('Header kitab tidak valid.');
    const b=record.item.book;
    if(manifest.kind==='categories'&&!manifest.categories.some(c=>c.id===b.cat&&JSON.stringify(c)===JSON.stringify(record.item.category)))fail('Kitab tidak termasuk kategori paket.');
    db.prepare('INSERT INTO compact_books VALUES (?,?)').run(part.id,b.bkid);
    const skip=!hasBookTitle(b)||!!db.prepare('SELECT 1 FROM books_meta WHERE bkid=?').get(b.bkid)||existsAdditional(b.bkid);
    if(!skip&&['pages','titles'].some(t=>db.prepare(`SELECT 1 FROM ${t} WHERE book_id=? LIMIT 1`).get(b.bkid)))fail('Ditemukan data halaman tanpa metadata untuk ID kitab ini. Import dihentikan agar tidak menimpa data.');
    current={item:record.item,expected:record.counts,pages:0,titles:0,skip};
   }else if(record.type==='page'||record.type==='title'){
    if(!current)fail('Halaman tanpa header kitab.');
    const page=record.type==='page',table=page?'pages':'titles';
    validateBookPackage({format:'maktabah-books',version:1,books:[{...current.item,pages:page?[record.row]:[],titles:page?[]:[record.row]}]});
    if(++current[table]>current.expected[table])fail('Jumlah halaman/daftar isi melebihi manifest kitab.');
    if(!current.skip){
     const row=record.row;
     if(row.id!==null&&db.prepare(`SELECT 1 FROM ${table} WHERE book_id=? AND id=?`).get(row.book_id,row.id))fail('ID halaman/daftar isi berulang.');
     const fields=page?['id','book_id','part','page','seal','nass']:['id','book_id','lvl','sub','tit'];
     db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).run(...fields.map(k=>row[k]??null));
     if(page)stats.pages++;
    }
    stats[page?'processedPages':'processedTitles']++;
   }else if(record.type==='book_end'){
    if(!current||record.bookId!==current.item.book.bkid||current.pages!==current.expected.pages||current.titles!==current.expected.titles)fail('Isi kitab belum lengkap.');
    if(current.skip)stats.skipped++;else{const result=importBooks(db,{format:'maktabah-books',version:1,books:[current.item]});if(result.imported!==1)fail('ID kitab berubah selama import.');stats.imported++;stats.importedCategories+=result.importedCategories;}
    stats.booksDone++;if(stats.booksDone>manifest.books)fail('Jumlah kitab melebihi manifest.');current=null;
   }else if(record.type==='end'){
    if(current||part.sequence!==s.total-1||record!==part.records.at(-1)||['books','pages','titles'].some(k=>record[k]!==manifest[k])||stats.booksDone!==manifest.books||stats.processedPages!==manifest.pages||stats.processedTitles!==manifest.titles)fail('Paket belum lengkap; penanda akhir tidak cocok.');
    status='done';
   }else fail('Jenis rekaman tidak dikenal.');
  }
  if(part.sequence===s.total-1&&status!=='done')fail('Paket tidak memiliki penanda akhir.');
  db.prepare('INSERT INTO compact_receipts VALUES (?,?,?)').run(part.id,part.sequence,hash);
  db.prepare('UPDATE compact_sessions SET status=?,next=?,current=?,stats=?,updated=? WHERE id=?').run(status,s.next+1,JSON.stringify(current),JSON.stringify(stats),Date.now(),part.id);
  return compactStatus(db,part.id);
 }).immediate();
}
export function prepareCompactDb(filename){
 const db=new Database(filename,{fileMustExist:true});db.pragma('busy_timeout=10000');
 if(db.pragma('journal_mode=WAL',{simple:true})!=='wal'){db.close();fail('Mode transaksi tidak tersedia.');}
 try{
  db.pragma('wal_checkpoint(TRUNCATE)');
  const wal=fs.existsSync(filename+'-wal')?fs.statSync(filename+'-wal').size:0;
  if(wal>128*1024*1024)fail('Transaksi pembaca masih aktif. Tunggu sebentar lalu lanjutkan import.',409);
  diskBudget(filename);
  return db;
 }catch(e){db.close();throw e;}
}
export function cancelCompact(db,id){
 const s=db.prepare('SELECT * FROM compact_sessions WHERE id=?').get(id);if(!s)fail('Sesi tidak ditemukan.',404);
 if(s.status==='done'||s.status==='cancelled')return compactStatus(db,id);
 const c=JSON.parse(s.current||'null');
 db.transaction(()=>db.prepare("UPDATE compact_sessions SET status='cancelling' WHERE id=?").run(id)).immediate();
 // Only the unfinished, newly reserved book has rows removed. Completed books survive.
 if(c&&!c.skip){
  if(db.prepare('SELECT 1 FROM books_meta WHERE bkid=?').get(c.item.book.bkid))fail('Metadata kitab berubah; pembersihan otomatis dibatalkan.',409);
  for(const table of ['pages','titles']){
   while(db.transaction(()=>db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE book_id=? LIMIT 250)`).run(c.item.book.bkid).changes).immediate())db.pragma('wal_checkpoint(TRUNCATE)');
  }
 }
 const stats=JSON.parse(s.stats);if(c&&!c.skip)stats.pages-=c.pages;
 db.transaction(()=>db.prepare("UPDATE compact_sessions SET status='cancelled',current=NULL,stats=?,updated=? WHERE id=?").run(JSON.stringify(stats),Date.now(),id)).immediate();
 return compactStatus(db,id);
}
