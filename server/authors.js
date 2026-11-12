import crypto from 'node:crypto';
import {normalizeIdentity,identityHash} from './author-package.js';
import {authorDeathDate,compareAuthorDates} from './author-chronology.js';
const err=(message,status=400)=>Object.assign(Error(message),{status});
const paging=(q,size=24)=>{const limit=Math.min(100,Math.max(1,parseInt(q.limit)||size)),page=Math.max(1,parseInt(q.page)||1);return{limit,page};};
const findText=s=>normalizeIdentity(s).replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي').toLowerCase();

export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) {
  let cache=null,generation=0;
  const invalidate=()=>{generation++;cache=null;};
  function graph(){
    const db=store.getDb();if(!db)throw err('Database penulis belum diimpor. Administrator dapat mengaktifkannya melalui Database Penulis.',503);
    const version=db.pragma('data_version',{simple:true}),libraryRevision=getLibraryRevision();
    if(cache&&cache.db===db&&cache.version===version&&cache.libraryRevision===libraryRevision&&cache.generation===generation&&Date.now()-cache.at<15000)return cache;
    const library=new Map(),conflicts=new Set();
    for(const b of getLibrary()) {
      if(!Number.isSafeInteger(b.bkid)||b.bkid<1||typeof b.bk!=='string'||!b.bk.trim())continue;
      const existing=library.get(b.bkid),key=normalizeIdentity(b.bk);if(existing&&existing.key!==key)conflicts.add(b.bkid);else library.set(b.bkid,{...b,key});
    }
    const authors=new Map(db.prepare('SELECT * FROM authors').all().map(a=>[a.id,{...a,workCount:0}]));
    const works=new Map(db.prepare('SELECT * FROM works').all().map(b=>[b.book_id,{...b,links:new Map()}]));
    for(const a of db.prepare('SELECT * FROM attributions').all())works.get(a.book_id)?.links.set(a.author_id,{...a,status:'matched'});
    for(const d of db.prepare('SELECT * FROM decisions').all()) {
      const w=works.get(d.book_id),a=authors.get(d.author_id);
      if(w&&a&&identityHash(w.title_key)===d.book_key&&identityHash(a.name_key)===d.author_key) {
        if(d.status==='rejected')w.links.delete(d.author_id);else w.links.set(d.author_id,{...d,basis:'admin-reviewed',evidence:d.note,status:'confirmed'});
      }
    }
    for(const w of works.values()){
      w.available=library.has(w.book_id)&&library.get(w.book_id).key===w.title_key&&!conflicts.has(w.book_id);
      for(const l of w.links.values())if(w.available&&authors.has(l.author_id))authors.get(l.author_id).workCount++;
    }
    cache={db,version,libraryRevision,generation,at:Date.now(),authors,works,library,conflicts};return cache;
  }
  const authorList=query=>{
    const g=graph(),{limit,page}=paging(query),q=findText(String(query.q||'').slice(0,200));
    const everyone=[...g.authors.values()].map(a=>({...a,deathDate:authorDeathDate(a.death_text)}));
    let all=everyone.filter(a=>!q||findText(a.name).includes(q));
    const eraCounts=new Map();for(const a of all){const c=a.deathDate.century;if(c)eraCounts.set(c,(eraCounts.get(c)||0)+1);}
    const unknown=all.filter(a=>a.deathDate.kind==='unknown').length,century=String(query.century||'');
    if(century&&century!=='unknown'&&!/^[1-9]\d?$/.test(century))throw err('Pilihan abad tidak valid.');
    if(century)all=all.filter(a=>century==='unknown'?a.deathDate.kind==='unknown':a.deathDate.century===Number(century));
    all.sort(query.sort==='death'?compareAuthorDates:(a,b)=>a.name.localeCompare(b.name,'ar')||a.id-b.id);
    if(query.timeline==='1') {
      const groups=new Map();
      for(const {biography,...a} of [...all].sort(compareAuthorDates)) {
        const date=a.deathDate,key=date.year!==null?`year-${date.year}`:date.kind==='unknown'?'unknown':`century-${date.century}`;
        if(!groups.has(key))groups.set(key,{key,label:date.year!==null?`${date.year} H`:date.label,authors:[]});
        groups.get(key).authors.push({...a,hasBiography:!!biography.trim()});
      }
      const ordered=[...groups.values()],size=10;
      if(query.start!==undefined&&!/^\d+$/.test(String(query.start)))throw err('Rentang linimasa tidak valid.');
      const start=Math.min(Math.max(0,ordered.length-size),query.start===undefined?Math.floor(ordered.length/2/size)*size:Number(query.start));
      return{groups:ordered.slice(start,start+size),start,end:Math.min(start+size,ordered.length),totalGroups:ordered.length};
    }
    return{data:all.slice((page-1)*limit,page*limit).map(({biography,...a})=>({...a,hasBiography:!!biography.trim()})),total:all.length,page,limit,totalPages:Math.ceil(all.length/limit),
      eras:[...eraCounts].sort((a,b)=>a[0]-b[0]).map(([century,count])=>({century,count})),unknownDates:unknown,
      overview:{authors:everyone.length,dated:everyone.filter(a=>a.deathDate.kind!=='unknown').length,linkedWorks:[...g.works.values()].filter(w=>w.available&&w.links.size>0).length}};
  };
  const related=(bookId,title)=>{
    const g=graph(),w=g.works.get(bookId);if(!w?.available||title&&normalizeIdentity(title)!==w.title_key)return[];
    return[...w.links.values()].filter(l=>g.authors.has(l.author_id)).map(l=>({id:l.author_id,name:g.authors.get(l.author_id).name,status:l.status,basis:l.basis,evidence:l.evidence}));
  };
  const detail=(id,query)=>{
    const g=graph(),a=g.authors.get(id);if(!a)throw err('Penulis tidak ditemukan.',404);
    const {limit,page}=paging(query),all=[...g.works.values()].filter(w=>w.available&&w.links.has(id)).sort((a,b)=>a.title.localeCompare(b.title,'ar'));
    return{data:a,works:all.slice((page-1)*limit,page*limit).map(w=>({book_id:w.book_id,title:w.title,...w.links.get(id),source_ref:w.source_ref})),total:all.length,page,limit,totalPages:Math.ceil(all.length/limit)};
  };
  const revision=(db,id)=>db.prepare('SELECT id FROM events WHERE book_id=? ORDER BY rowid DESC LIMIT 1').get(id)?.id||'initial';
  function bookCase(bookId){
    const g=graph(),live=g.library.get(bookId);if(!live)throw err('Kitab tidak ada pada pustaka server ini.',404);
    const w=g.works.get(bookId),decisions=g.db.prepare('SELECT * FROM decisions WHERE book_id=?').all(bookId);
    return{book_id:bookId,title:live.bk,metadata_author:w?.metadata_author||'',source_ref:w?.source_ref||'Metadata pustaka server saat ini',
      conflict:g.conflicts.has(bookId)||!!w&&w.title_key!==live.key,revision:revision(g.db,bookId),
      links:related(bookId,live.bk),decisions:decisions.map(d=>({...d,name:g.authors.get(d.author_id)?.name||''})),
      events:g.db.prepare('SELECT * FROM events WHERE book_id=? ORDER BY created_at DESC,rowid DESC LIMIT 50').all(bookId)};
  }
  const review=query=>{
    const g=graph(),{limit,page}=paging(query,20),q=findText(String(query.q||'').slice(0,200)),filter=query.filter||'pending';
    const all=[];let pending=0,linked=0,conflicts=0;
    for(const [id,b] of g.library){const w=g.works.get(id),conflict=g.conflicts.has(id)||!!w&&w.title_key!==b.key,isLinked=!conflict&&!!w?.links.size;
      if(conflict)conflicts++;else if(isLinked)linked++;else pending++;
      if(filter==='pending'&&(isLinked||conflict)||filter==='linked'&&!isLinked||filter==='conflict'&&!conflict)continue;
      if(q&&!findText(`${b.bk} ${w?.metadata_author||''}`).includes(q))continue;
      all.push({book_id:id,title:b.bk,metadata_author:w?.metadata_author||'',status:conflict?'conflict':isLinked?'linked':'pending',count:isLinked?w.links.size:0});
    }
    all.sort((a,b)=>a.book_id-b.book_id);
    return{data:all.slice((page-1)*limit,page*limit),total:all.length,page,limit,totalPages:Math.ceil(all.length/limit),counts:{pending,linked,conflicts,available:g.library.size}};
  };
  function decide(body){
    const g=graph(),bookId=Number(body.book_id),authorId=Number(body.author_id),a=g.authors.get(authorId),live=g.library.get(bookId);
    if(!Number.isSafeInteger(bookId)||!Number.isSafeInteger(authorId)||!a||!live)throw err('Kitab atau penulis tidak valid.');
    if(normalizeIdentity(body.expected_author)!==a.name_key)throw err('Identitas penulis berubah. Muat ulang dan pilih penulis kembali sebelum menyimpan.',409);
    if(g.conflicts.has(bookId))throw err('ID kitab memiliki judul ganda. Selesaikan konflik katalog sebelum menautkan penulis.',409);
    if(normalizeIdentity(body.expected_title)!==live.key)throw err('Judul kitab berubah. Muat ulang pratinjau sebelum menyimpan.',409);
    if(!['confirmed','rejected','reset'].includes(body.action)||typeof body.note!=='string'||body.note.trim().length<3||body.note.length>10000)throw err('Tulis dasar keputusan atau rujukan (3–10.000 karakter).');
    const db=g.db;db.transaction(()=>{
      if(body.revision!==revision(db,bookId))throw err('Relasi sudah diubah admin lain. Muat ulang sebelum menyimpan.',409);
      const old=db.prepare('SELECT title_key FROM works WHERE book_id=?').get(bookId);
      if(old&&old.title_key!==live.key)throw err('Identitas kitab dalam paket berbeda. Impor paket yang diperbarui sebelum meninjau.',409);
      if(!old){db.prepare('INSERT INTO works VALUES(?,?,?,?,?)').run(bookId,live.bk,'','Metadata pustaka; tinjauan admin',live.key);db.prepare('UPDATE manifest SET works=(SELECT count(*) FROM works)').run();}
      if(body.action==='reset')db.prepare('DELETE FROM decisions WHERE book_id=? AND author_id=?').run(bookId,authorId);
      else db.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?,?) ON CONFLICT(book_id,author_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=excluded.updated_at,book_key=excluded.book_key,author_key=excluded.author_key').run(bookId,authorId,body.action,body.note.trim(),new Date().toISOString(),identityHash(live.key),identityHash(a.name_key));
      db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(crypto.randomBytes(16).toString('hex'),new Date().toISOString(),bookId,authorId,body.action,body.note.trim());
    })();invalidate();return bookCase(bookId);
  }
  return{authorList,detail,related,review,bookCase,decide,invalidate};
}
export function registerAuthors(app,{service,requireAdmin}) {
  const route=handler=>(req,res)=>{try{res.json(handler(req));}catch(e){res.status(e.status||400).json({error:e.message});}};
  app.get('/api/authors',route(req=>service.authorList(req.query)));
  app.get('/api/authors/book/:id',route(req=>({data:service.related(Number(req.params.id))})));
  app.get('/api/authors/:id',route(req=>service.detail(Number(req.params.id),req.query)));
  app.get('/api/admin/authors/review',requireAdmin,route(req=>service.review(req.query)));
  app.get('/api/admin/authors/book/:id',requireAdmin,route(req=>service.bookCase(Number(req.params.id))));
  app.post('/api/admin/authors/decision',requireAdmin,route(req=>service.decide(req.body||{})));
}
