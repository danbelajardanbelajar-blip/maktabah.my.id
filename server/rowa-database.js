import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {canonicalizeRowaPackage,summarizeRowa,MAX_PACKAGE,FORMAT,VERSION} from './rowa-package.js';

const validId = id => typeof id==='string' && /^[a-f0-9]{32}$/.test(id);
export function createRowaStore(directory, getFallback = () => null) {
  fs.mkdirSync(directory,{recursive:true});
  const versions = path.join(directory,'versions'); fs.mkdirSync(versions,{recursive:true});
  const pointer = path.join(directory,'active.json');
  let active = null, connection = null, startupError = null;
  const file = id => {
    if(!validId(id)) throw new Error('ID database tidak valid.');
    return path.join(versions,`${id}.db`);
  };
  const open = id => {
    const db = new Database(file(id),{readonly:true,fileMustExist:true});
    try {
      db.pragma('trusted_schema=OFF');
      const m = db.prepare('SELECT * FROM rowa_manifest').get();
      if(m?.format!==FORMAT || m.version!==VERSION || db.pragma('quick_check',{simple:true})!=='ok') throw new Error('Database perawi aktif tidak valid.');
      return db;
    } catch(e) {db.close();throw e;}
  };
  const activate = id => {
    const next = open(id);
    const value = {id,activatedAt:new Date().toISOString()};
    const pending = path.join(directory,`active.${crypto.randomBytes(8).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(pending,JSON.stringify(value),{mode:0o600});
      fs.renameSync(pending,pointer);
    } catch(e) {next.close();fs.rmSync(pending,{force:true});throw e;}
    const previous = connection; connection = next; active = value; startupError = null;
    previous?.close();
    return status();
  };
  if(fs.existsSync(pointer)) {
    try {active=JSON.parse(fs.readFileSync(pointer,'utf8'));connection=open(active.id);}
    catch(error) {startupError=error.message;active=null;}
  }
  function refresh() {
    if(!fs.existsSync(pointer))return;
    try {
      const value=JSON.parse(fs.readFileSync(pointer,'utf8'));
      if(value.id===active?.id && connection)return;
      const next=open(value.id),previous=connection;
      connection=next;active=value;startupError=null;previous?.close();
    } catch(e) {startupError=e.message;}
  }
  function status() {
    refresh();
    const backups = [];
    for(const name of fs.readdirSync(versions).filter(n=>/^[a-f0-9]{32}\.db$/.test(n))) {
      const id=name.slice(0,-3);if(id===active?.id)continue;
      let db;
      try {db=open(id);const manifest=db.prepare('SELECT * FROM rowa_manifest').get();backups.push({id,manifest,bytes:fs.statSync(file(id)).size});}
      catch { /* Incomplete versions are never offered as a restore target. */ }
      finally {db?.close();}
    }
    return {active:active?{...active,manifest:connection.prepare('SELECT * FROM rowa_manifest').get(),...summarizeRowa(connection),bytes:fs.statSync(file(active.id)).size}:null,
      fallback:!connection, startupError, backups, maxBytes:MAX_PACKAGE};
  }
  return {directory, getDb:()=>{refresh();return connection || getFallback();}, status, activate,
    install(staged) {const id=crypto.randomBytes(16).toString('hex');fs.copyFileSync(staged,file(id),fs.constants.COPYFILE_EXCL);return activate(id);},
    activeFile:()=>{refresh();return active?file(active.id):null;},
    close(){connection?.close();connection=null;},
  };
}

export function registerRowaDatabase(app,{store,requireAdmin}) {
  const staging = path.join(store.directory,'staging');fs.mkdirSync(staging,{recursive:true});
  // Tickets survive a server restart, but expire after one day.
  for(const name of fs.readdirSync(staging)) {
    const filename=path.join(staging,name);
    if(fs.statSync(filename).mtimeMs < Date.now()-86400000) fs.rmSync(filename,{force:true});
  }
  let busy = false;
  app.get('/api/admin/rowa-database',requireAdmin,(_req,res)=>{
    try {res.json(store.status());} catch(e){res.status(500).json({error:e.message});}
  });
  app.get('/api/admin/rowa-database/download',requireAdmin,(_req,res)=>{
    const filename=store.activeFile();
    if(!filename)return res.status(404).json({error:'Database perawi khusus belum diimpor.'});
    res.set('Cache-Control','no-store');res.download(filename,'maktabah-perawi.db');
  });
  app.post('/api/admin/rowa-database/upload',requireAdmin,async(req,res)=>{
    if(busy)return res.status(409).json({error:'Import perawi lain sedang berjalan.'});
    if(!req.is('application/octet-stream')) return res.status(415).json({error:'Upload harus berupa file .db biner.'});
    const length = Number(req.headers['content-length']);
    if(!Number.isSafeInteger(length)||length<16)return res.status(411).json({error:'Ukuran file tidak valid.'});
    if(length>MAX_PACKAGE)return res.status(413).json({error:'Ukuran database maksimal 128 MB.'});
    const disk=fs.statfsSync(staging);
    if(disk.bavail*disk.bsize < length*4+32*1024*1024)return res.status(507).json({error:'Ruang penyimpanan tidak cukup untuk validasi dan cadangan.'});
    busy=true;
    const id=crypto.randomBytes(16).toString('hex'),raw=path.join(staging,`${id}.upload`),canonical=path.join(staging,`${id}.db`),metadata=path.join(staging,`${id}.json`);
    try {
      let received=0;
      req.setTimeout(120000);
      await pipeline(req,new Transform({transform(chunk,_encoding,done){received+=chunk.length;done(received>length||received>MAX_PACKAGE?new Error('Upload melebihi ukuran yang diizinkan.'):null,chunk);}}),fs.createWriteStream(raw,{flags:'wx',mode:0o600}));
      if(received!==length)throw new Error('File upload terpotong.');
      const preview=canonicalizeRowaPackage(raw,canonical);
      const ticket={id,createdAt:Date.now(),preview};
      fs.writeFileSync(metadata,JSON.stringify(ticket),{mode:0o600});
      res.json(ticket);
    } catch(e) {
      fs.rmSync(canonical,{force:true});fs.rmSync(metadata,{force:true});
      if(!res.headersSent&&!res.destroyed)res.status(400).json({error:e.message});
    } finally {fs.rmSync(raw,{force:true});busy=false;}
  });
  app.post('/api/admin/rowa-database/activate',requireAdmin,(req,res)=>{
    if(busy)return res.status(409).json({error:'Import perawi lain sedang berjalan.'});
    const id=req.body?.id;
    if(!validId(id))return res.status(400).json({error:'ID paket tidak valid.'});
    busy=true;
    try {
      const filename=path.join(staging,`${id}.json`);
      if(!fs.existsSync(filename))return res.status(404).json({error:'Pratinjau import tidak ditemukan. Upload kembali file.'});
      const ticket=JSON.parse(fs.readFileSync(filename,'utf8'));
      if(Date.now()-ticket.createdAt>86400000)return res.status(410).json({error:'Pratinjau import kedaluwarsa. Upload kembali file.'});
      const status=store.install(path.join(staging,`${id}.db`));
      fs.rmSync(filename,{force:true});fs.rmSync(path.join(staging,`${id}.db`),{force:true});
      res.json({success:true,...status});
    } catch(e) {res.status(400).json({error:e.message});}
    finally {busy=false;}
  });
  app.post('/api/admin/rowa-database/restore',requireAdmin,(req,res)=>{
    if(busy)return res.status(409).json({error:'Import perawi lain sedang berjalan.'});
    if(!validId(req.body?.id))return res.status(400).json({error:'ID cadangan tidak valid.'});
    try {res.json({success:true,...store.activate(req.body.id)});}
    catch(e){res.status(400).json({error:e.message});}
  });
}
