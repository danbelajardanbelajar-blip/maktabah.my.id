import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import Database from 'better-sqlite3';import {Transform} from 'node:stream';import {pipeline} from 'node:stream/promises';
import {AUTHOR_FORMAT,AUTHOR_VERSION,AUTHOR_MAX_BYTES,authorStats,inspectAuthorPackage,identityHash} from './author-package.js';

const validId=s=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s);
export function createAuthorStore(directory) {
  const versions=path.join(directory,'versions'),pointer=path.join(directory,'active.json');fs.mkdirSync(versions,{recursive:true});
  let current=null,db=null,error=null;
  const file=id=>{if(!validId(id))throw Error('ID versi tidak valid.');return path.join(versions,`${id}.db`);};
  const open=id=>{
    const next=new Database(file(id),{fileMustExist:true});
    try{next.pragma('trusted_schema=OFF');next.pragma('foreign_keys=ON');next.pragma('busy_timeout=5000');const m=next.prepare('SELECT * FROM manifest').get();if(m?.format!==AUTHOR_FORMAT||m.version!==AUTHOR_VERSION)throw Error('Format database aktif salah.');next.pragma('journal_mode=WAL');return next;}
    catch(e){next.close();throw e;}
  };
  function refresh(){if(!fs.existsSync(pointer))return;try{const value=JSON.parse(fs.readFileSync(pointer,'utf8'));if(value.id===current?.id&&db)return;const next=open(value.id),old=db;db=next;current=value;error=null;old?.close();}catch(e){error=e.message;}}
  function status(){refresh();const backups=[];for(const name of fs.readdirSync(versions).filter(n=>/^[a-f0-9]{32}\.db$/.test(n))){const id=name.slice(0,-3);if(id===current?.id)continue;let old;try{old=new Database(file(id),{readonly:true,fileMustExist:true});backups.push({id,manifest:old.prepare('SELECT * FROM manifest').get()});}catch{}finally{old?.close();}}
    return{active:db?{...current,manifest:db.prepare('SELECT * FROM manifest').get(),...authorStats(db)}:null,backups,startupError:error,maxBytes:AUTHOR_MAX_BYTES};}
  function activate(id,preserve=false){
    refresh();const next=open(id);let preserved=0,skipped=0;
    try{
      if(preserve&&db)next.transaction(()=>{
        const put=next.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?,?) ON CONFLICT(book_id,author_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=excluded.updated_at,book_key=excluded.book_key,author_key=excluded.author_key');
        for(const d of db.prepare('SELECT * FROM decisions').iterate()){
          const a=next.prepare('SELECT name_key FROM authors WHERE id=?').get(d.author_id),b=next.prepare('SELECT title_key FROM works WHERE book_id=?').get(d.book_id);
          if(a&&b&&identityHash(a.name_key)===d.author_key&&identityHash(b.title_key)===d.book_key){put.run(d.book_id,d.author_id,d.status,d.note,d.updated_at,d.book_key,d.author_key);preserved++;
            next.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(crypto.randomBytes(16).toString('hex'),new Date().toISOString(),d.book_id,d.author_id,'preserved-on-import',d.note);
          }else skipped++;
        }
        const copyEvent=next.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?)');
        for(const e of db.prepare('SELECT * FROM events').iterate()) {
          const oldA=db.prepare('SELECT name_key FROM authors WHERE id=?').get(e.author_id),oldB=db.prepare('SELECT title_key FROM works WHERE book_id=?').get(e.book_id);
          const newA=next.prepare('SELECT name_key FROM authors WHERE id=?').get(e.author_id),newB=next.prepare('SELECT title_key FROM works WHERE book_id=?').get(e.book_id);
          if(oldA&&oldB&&newA&&newB&&oldA.name_key===newA.name_key&&oldB.title_key===newB.title_key)copyEvent.run(e.id,e.created_at,e.book_id,e.author_id,e.action,e.note);
        }
      })();
      const value={id,activatedAt:new Date().toISOString()},temp=path.join(directory,`active.${crypto.randomBytes(8).toString('hex')}.tmp`);
      try{fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600});fs.renameSync(temp,pointer);}catch(e){fs.rmSync(temp,{force:true});throw e;}
      const old=db;db=next;current=value;error=null;old?.close();return{...status(),preservedDecisions:preserved,skippedDecisions:skipped};
    }catch(e){next.close();throw e;}
  }
  refresh();
  return{directory,getDb(){refresh();return db;},status,activate,
    install(staged){const id=crypto.randomBytes(16).toString('hex');fs.copyFileSync(staged,file(id),fs.constants.COPYFILE_EXCL);return activate(id,true);},
    close(){db?.close();db=null;},
  };
}

export function registerAuthorTransfer(app,{store,requireAdmin}) {
  const folder=path.join(store.directory,'staging');fs.mkdirSync(folder,{recursive:true});
  for(const n of fs.readdirSync(folder)){const p=path.join(folder,n);if(fs.statSync(p).mtimeMs<Date.now()-86400000)fs.rmSync(p,{force:true});}
  let busy=false;
  const fail=(res,e)=>res.status(400).json({error:e.message});
  app.get('/api/admin/authors-database',requireAdmin,(_req,res)=>{try{res.json(store.status());}catch(e){fail(res,e);}});
  app.post('/api/admin/authors-database/upload',requireAdmin,async(req,res)=>{
    if(busy)return res.status(409).json({error:'Transfer penulis lain sedang berjalan.'});
    if(!req.is('application/octet-stream'))return res.status(415).json({error:'Pilih paket database .db penulis.'});
    const length=Number(req.headers['content-length']);if(!Number.isSafeInteger(length)||length<16)return res.status(411).json({error:'Ukuran file tidak valid.'});
    if(length>AUTHOR_MAX_BYTES)return res.status(413).json({error:'Ukuran maksimal 64 MB.'});
    const disk=fs.statfsSync(folder);if(disk.bavail*disk.bsize<length*4+32*1024*1024)return res.status(507).json({error:'Ruang penyimpanan tidak cukup.'});
    const id=crypto.randomBytes(16).toString('hex'),raw=path.join(folder,`${id}.upload`),clean=path.join(folder,`${id}.db`);busy=true;
    try{let size=0;req.setTimeout(120000);await pipeline(req,new Transform({transform(c,_enc,done){size+=c.length;done(size>length?Error('Upload melebihi ukuran.'):null,c);}}),fs.createWriteStream(raw,{flags:'wx',mode:0o600}));if(size!==length)throw Error('Upload terpotong.');const preview=inspectAuthorPackage(raw,clean),ticket={id,createdAt:Date.now(),preview};fs.writeFileSync(path.join(folder,`${id}.json`),JSON.stringify(ticket),{mode:0o600});res.json(ticket);}
    catch(e){fs.rmSync(clean,{force:true});if(!res.destroyed)fail(res,e);}finally{fs.rmSync(raw,{force:true});busy=false;}
  });
  app.post('/api/admin/authors-database/activate',requireAdmin,(req,res)=>{
    if(busy)return res.status(409).json({error:'Transfer penulis lain sedang berjalan.'});
    const id=req.body?.id;if(!validId(id))return res.status(400).json({error:'ID paket tidak valid.'});busy=true;
    try{const metadata=path.join(folder,`${id}.json`);if(!fs.existsSync(metadata))return res.status(404).json({error:'Upload ulang paket untuk mendapatkan pratinjau.'});const ticket=JSON.parse(fs.readFileSync(metadata,'utf8'));if(Date.now()-ticket.createdAt>86400000)return res.status(410).json({error:'Pratinjau kedaluwarsa.'});const status=store.install(path.join(folder,`${id}.db`));fs.rmSync(metadata,{force:true});fs.rmSync(path.join(folder,`${id}.db`),{force:true});res.json(status);}
    catch(e){fail(res,e);}finally{busy=false;}
  });
  app.post('/api/admin/authors-database/restore',requireAdmin,(req,res)=>{
    if(busy)return res.status(409).json({error:'Transfer penulis lain sedang berjalan.'});
    try{if(!validId(req.body?.id))throw Error('ID versi tidak valid.');res.json(store.activate(req.body.id));}catch(e){fail(res,e);}
  });
  app.get('/api/admin/authors-database/download',requireAdmin,async(_req,res)=>{
    const db=store.getDb();if(!db)return res.status(404).json({error:'Database penulis belum aktif.'});
    const output=path.join(folder,`download-${crypto.randomBytes(16).toString('hex')}.db`);
    try{await db.backup(output);res.set('Cache-Control','no-store');res.download(output,'maktabah-penulis.db',()=>fs.rmSync(output,{force:true}));}
    catch(e){fs.rmSync(output,{force:true});if(!res.headersSent)fail(res,e);}
  });
}
