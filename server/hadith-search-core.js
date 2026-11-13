import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import {hadithBooks} from './hadith-books.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};

export const normalizeHadith=text=>String(text||'').normalize('NFKC').replace(/<[^>]*>/g,' ').replace(/[\u064B-\u065F\u0670\u0640]/gu,'').replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي').replace(/[\u00C0-\u024F]/gu,c=>c.normalize('NFD').replace(/[\u0300-\u036f]/gu,'')).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function hadithMatch(query,matching='all') {
  if(typeof query!=='string'||query.trim().length<2||query.length>300)fail('Tulis teks pencarian antara 2–300 karakter.');
  if(!['all','phrase'].includes(matching))fail('Jenis pencocokan tidak valid.');
  const words=normalizeHadith(query).split(' ').filter(Boolean);
  if(!words.length||words.length>12||words.some(w=>w.length>64))fail('Gunakan 1–12 kata, maksimal 64 karakter per kata.');
  return words;
}
export function hadithExcerpt(raw,words) {
  const text=String(raw||'').replace(/<[^>]*>/g,' ').replace(/[\uE000\uE001]/gu,'');
  const map=[],folded=[];
  for(let i=0;i<text.length;i++){
    const c=text[i];if(/[\u064B-\u065F\u0670\u0640]/u.test(c))continue;
    const normalized=normalizeHadith(c)||' ';for(const part of normalized){folded.push(part);map.push(i);}
  }
  const normalized=folded.join('');const spans=[];
  for(const word of [...new Set(words)]){let index=0;while((index=normalized.indexOf(word,index))>=0){spans.push([map[index],map[index+word.length-1]+1]);index+=word.length;if(spans.length>=150)break;}}
  spans.sort((a,b)=>a[0]-b[0]);const start=Math.max(0,(spans[0]?.[0]||0)-100),end=Math.min(text.length,start+550),merged=[];
  for(const [a,b] of spans){if(a<start||a>=end)continue;const previous=merged.at(-1);if(previous&&a<=previous[1])previous[1]=Math.min(end,Math.max(b,previous[1]));else merged.push([a,Math.min(end,b)]);}
  let snippet=start?'…':'',cursor=start;for(const [a,b] of merged){snippet+=text.slice(cursor,a)+'\uE000'+text.slice(a,b)+'\uE001';cursor=b;}return snippet+text.slice(cursor,end)+(end<text.length?'…':'');
}

export function searchHadith({paths,query,indexPath}) {
  const q=typeof query.q==='string'?query.q.trim():query.q,matching=query.matching||'all',words=hadithMatch(q,matching);
  const page=Number(query.page||1);if(!Number.isSafeInteger(page)||page<1||page>100)fail('Halaman pencarian harus antara 1–100. Persempit teks jika hasil terlalu banyak.');
  const databases=[];
  try {
    const metadata=[];
    for(const path of paths){const db=new Database(path,{readonly:true,fileMustExist:true,timeout:2000});databases.push(db);db.pragma('cache_size=-16384');metadata.push(db.prepare('SELECT bkid,bk FROM books_meta').all());}
    const catalogue=hadithBooks(metadata.flat()),group=catalogue.groups.find(g=>g.key===(query.group||'nine'));
    if(!group)fail('Kelompok kitab tidak valid.');
    if(query.book&&!group.books.includes(query.book))fail('Kitab tidak termasuk dalam kelompok yang dipilih.');
    const sources=catalogue.books.filter(b=>group.books.includes(b.key)&&(!query.book||b.key===query.book));
    let editions=sources.flatMap(b=>b.editions.map(e=>({...e,sourceName:b.name})));
    if(query.edition){const id=Number(query.edition);if(!Number.isSafeInteger(id)||id<1||!editions.some(e=>e.id===id))fail('Edisi tidak termasuk dalam lingkup pencarian.');editions=editions.filter(e=>e.id===id);}
    const allowed=new Map(editions.map(e=>[e.id,e])),results=[],limit=20;
    if(!indexPath||!fs.existsSync(indexPath))throw Object.assign(Error('Indeks Kutub Hadis sedang disiapkan.'),{status:503,code:'HADITH_INDEX_STALE'});
    const index=new Database(indexPath,{readonly:true,fileMustExist:true});
    try {
      const fingerprint=hadithFingerprint(paths,catalogue);
      if(index.prepare('SELECT value FROM manifest WHERE key=?').get('fingerprint')?.value!==fingerprint)throw Object.assign(Error('Indeks Kutub Hadis perlu diperbarui.'),{status:503,code:'HADITH_INDEX_STALE'});
      if(allowed.size){
        const textMatch=matching==='phrase'?`"${words.join(' ')}"`:words.map(word=>`"${word}"`).join(' AND ');
        const match=`text : (${textMatch}) AND scope : (${[...allowed.keys()].map(id=>`"b${id}"`).join(' OR ')})`;
        const rows=index.prepare('SELECT d.book_id AS bookId,d.page_id AS pageId,d.source FROM page_index JOIN documents d ON d.id=page_index.rowid WHERE page_index MATCH ? ORDER BY page_index.rowid LIMIT ? OFFSET ?').all(match,limit+1,(page-1)*limit);
        for(const row of rows){
          const original=databases[row.source]?.prepare('SELECT part,page,nass FROM pages WHERE book_id=? AND id=?').get(row.bookId,row.pageId);
          if(!original)throw Object.assign(Error('Indeks Kutub Hadis perlu diperbarui.'),{status:503,code:'HADITH_INDEX_STALE'});
          const text=' '+normalizeHadith(original.nass)+' ';
          if(!(matching==='phrase'?text.includes(' '+words.join(' ')+' '):words.every(word=>text.includes(' '+word+' '))))throw Object.assign(Error('Indeks Kutub Hadis perlu diperbarui.'),{status:503,code:'HADITH_INDEX_STALE'});
          results.push({bookId:row.bookId,pageId:row.pageId,part:original.part,page:original.page,bookName:allowed.get(row.bookId).title,sourceName:allowed.get(row.bookId).sourceName,snippet:hadithExcerpt(original.nass,words)});
        }
      }
    }finally{index.close();}
    return{results:results.slice(0,limit),hasMore:results.length>limit,page,limit,q,matching,scope:{group:group.key,name:group.name,book:query.book||null,edition:query.edition?Number(query.edition):null,sources:sources.filter(b=>b.editions.length>0).length,editions:editions.length}};
  }finally{for(const db of databases)db.close();}
}

export function hadithFingerprint(paths,catalogue){return crypto.createHash('sha256').update(JSON.stringify({version:1,paths,editions:catalogue.books.flatMap(b=>b.editions).sort((a,b)=>a.id-b.id)})).digest('hex');}

export function activeHadithIndex(directory){
  try{const pointer=JSON.parse(fs.readFileSync(path.join(directory,'active.json'),'utf8'));if(/^index-[a-f0-9-]+\.db$/.test(pointer.file)&&!fs.existsSync(path.join(directory,'dirty')))return path.join(directory,pointer.file);}catch{}
  return null;
}

export function buildHadithIndex({paths,directory},onProgress=()=>{}) {
  fs.mkdirSync(directory,{recursive:true});
  const databases=[],filename=path.join(directory,`index-${Date.now().toString(16)}-${crypto.randomBytes(6).toString('hex')}.db`);let index;
  try {
    const metadata=[];
    for(const file of paths){const db=new Database(file,{readonly:true,fileMustExist:true,timeout:2000});databases.push(db);db.pragma('cache_size=-8192');db.exec('BEGIN');metadata.push(db.prepare('SELECT bkid,bk FROM books_meta').all());}
    const catalogue=hadithBooks(metadata.flat()),allowed=new Set(catalogue.books.flatMap(b=>b.editions.map(e=>e.id)));
    index=new Database(filename);index.pragma('journal_mode=OFF');index.pragma('synchronous=OFF');index.pragma('cache_size=-16384');
    index.exec("CREATE TABLE manifest(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE documents(id INTEGER PRIMARY KEY,book_id INTEGER,page_id INTEGER,source INTEGER,UNIQUE(book_id,page_id));CREATE VIRTUAL TABLE page_index USING fts5(text,scope,content='');");
    const doc=index.prepare('INSERT OR IGNORE INTO documents(book_id,page_id,source) VALUES(?,?,?)'),put=index.prepare('INSERT INTO page_index(rowid,text,scope) VALUES(?,?,?)');let count=0;
    for(let source=0;source<databases.length;source++){
      const db=databases[source],ids=[...new Set(metadata[source].map(b=>b.bkid))].filter(id=>allowed.has(id)).sort((a,b)=>a-b);
      for(const id of ids){
        index.exec('BEGIN');
        for(const page of db.prepare('SELECT id,nass FROM pages WHERE book_id=? ORDER BY id').iterate(id)){
          const row=doc.run(id,page.id,source);if(!row.changes)continue;
          put.run(row.lastInsertRowid,normalizeHadith(page.nass),'b'+id);count++;
          if(count%3000===0){index.exec('COMMIT');onProgress({pages:count});index.exec('BEGIN');}
        }
        index.exec('COMMIT');onProgress({pages:count});
      }
    }
    index.prepare('INSERT INTO manifest VALUES(?,?)').run('fingerprint',hadithFingerprint(paths,catalogue));
    index.prepare('INSERT INTO manifest VALUES(?,?)').run('pages',String(count));
    if(index.pragma('quick_check',{simple:true})!=='ok')throw Error('Pemeriksaan indeks Kutub Hadis gagal.');
    index.close();index=null;
    const pointer=path.join(directory,'active-'+crypto.randomBytes(6).toString('hex')+'.json');fs.writeFileSync(pointer,JSON.stringify({file:path.basename(filename),pages:count,createdAt:new Date().toISOString()}));fs.renameSync(pointer,path.join(directory,'active.json'));
    // Retain the active generation and one previous derived index. Never touch
    // source databases, directories, links, or files outside this cache folder.
    const root=path.resolve(directory),older=fs.readdirSync(root).filter(name=>/^index-[a-f0-9-]+\.db$/.test(name)&&name!==path.basename(filename))
      .map(name=>path.resolve(root,name)).filter(file=>path.dirname(file)===root&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink()).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
    for(const old of older.slice(1)){try{fs.rmSync(old);}catch{/* An existing Windows reader may still hold this generation. */}}
    return{filename,pages:count};
  }catch(e){if(index?.open)index.close();fs.rmSync(filename,{force:true});throw e;}
  finally{for(const db of databases)db.close();}
}
