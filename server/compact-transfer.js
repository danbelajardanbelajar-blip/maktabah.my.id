import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {ensureCompactSchema,activeCompact,compactStatus,startCompact,decodePart,MAX_COMPRESSED,RESERVE} from './compact-transfer-core.js';

export function registerCompactTransfer(app,{getDb,getDbPath,getAdditionalPath,requireAdmin,localExportMode,runtime,directory,clearCache}){
 fs.mkdirSync(directory,{recursive:true});
 if(!localExportMode){ensureCompactSchema(getDb());runtime.compactSession=activeCompact(getDb());}
 const exports=new Map();let exporting=false,receiving=false;
 const persist=job=>{const filename=path.join(directory,job.id+'.json');fs.writeFileSync(filename+'.tmp',JSON.stringify(job));fs.renameSync(filename+'.tmp',filename);};
 for(const file of fs.readdirSync(directory).filter(n=>/^[a-f0-9]{48}\.json$/.test(n))){
  try{
   const job=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
   if(job.id!==file.slice(0,-5)||!['running','ready','failed'].includes(job.status))continue;
   job.downloads=0;
   if(job.status==='running'||(job.status==='ready'&&!fs.existsSync(path.join(directory,job.id+'.mkt')))){
    job.status='failed';job.error='Export terputus saat server dimulai ulang. Buat export kembali.';job.finishedAt=Date.now();
    fs.rmSync(path.join(directory,job.id+'.mkt'),{force:true});persist(job);
   }
   exports.set(job.id,job);
  }catch{}
 }
 const worker=(options,onProgress=()=>{})=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL('./compact-transfer-worker.js',import.meta.url),{workerData:options});let finished=false;
  w.on('message',m=>{if(m.type==='progress')onProgress(m.data);else if(m.type==='done'){finished=true;resolve(m.result);}else if(m.type==='failed'){finished=true;reject(Object.assign(new Error(m.error),{status:m.status}));}});
  w.on('error',reject);w.on('exit',code=>{if(!finished)reject(new Error('Proses terhenti ('+code+'). Muat status lalu lanjutkan bagian terakhir.'));});
 });
 const fail=(res,e)=>{if(!res.destroyed)res.status(e.status||400).json({error:e.message});};
 const json=(res,data)=>res.set('Cache-Control','no-store').json(data);
 const receive=async req=>{
  const length=Number(req.headers['content-length']);
  if(!Number.isSafeInteger(length)||length<1||length>MAX_COMPRESSED)throw new Error('Ukuran bagian harus diketahui dan maksimal 8 MB.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>MAX_COMPRESSED||size>length)throw new Error('Bagian terlalu besar.');chunks.push(chunk);}
  if(size!==length)throw new Error('Bagian belum diterima lengkap.');
  return Buffer.concat(chunks);
 };
 app.post('/api/admin/compact/export',requireAdmin,(req,res)=>{
  if(exporting||receiving||runtime.importing||runtime.deleting||runtime.compactSession)return res.status(409).json({error:'Selesaikan proses transfer yang aktif terlebih dahulu.'});
  const id=crypto.randomBytes(24).toString('hex'),filename=path.join(directory,id+'.mkt');
  const job={id,status:'running',progress:{}};exports.set(id,job);exporting=true;runtime.compactExport=true;persist(job);
  worker({action:'export',dbPath:path.resolve(getDbPath()),additionalPath:getAdditionalPath(),selection:req.body,outputPath:filename},p=>{job.progress=p;})
   .then(result=>{job.status='ready';job.result=result;job.finishedAt=Date.now();persist(job);})
   .catch(e=>{job.status='failed';job.error=e.message;job.finishedAt=Date.now();persist(job);})
   .finally(()=>{exporting=false;runtime.compactExport=false;});
  res.status(202).json(job);
 });
 app.get('/api/admin/compact/exports/:id',requireAdmin,(req,res)=>{
  const job=exports.get(req.params.id);if(!job)return res.status(404).json({error:'Export tidak ditemukan. Buat export ulang bila server dimulai ulang.'});
  json(res,{...job,downloadUrl:job.status==='ready'?'/api/admin/compact/download/'+job.id:null});
 });
 // Download ticket is random (192 bit), expires after 24 hours, same pattern as legacy exports.
 app.get('/api/admin/compact/download/:id',(req,res)=>{
  const job=exports.get(req.params.id);
  if(!job||job.status!=='ready'||Date.now()-job.finishedAt>86400000)return res.sendStatus(404);
  job.downloads=(job.downloads||0)+1;res.once('close',()=>job.downloads--);
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  res.download(path.join(directory,job.id+'.mkt'),'maktabah-bertahap-'+new Date().toISOString().slice(0,10)+'.mkt');
 });
 app.get('/api/admin/compact/current',requireAdmin,(req,res)=>json(res,localExportMode?null:runtime.compactSession?{...compactStatus(getDb(),runtime.compactSession),busy:receiving||runtime.importing}:null));
 app.get('/api/admin/compact/import/:id',requireAdmin,(req,res)=>{
  const s=localExportMode?null:compactStatus(getDb(),req.params.id);
  if(!s)return res.status(404).json({error:'Sesi import tidak ditemukan.'});json(res,{...s,busy:receiving||runtime.importing});
 });
 const unlocked=res=>{
  if(localExportMode){res.status(403).json({error:'Import dilakukan pada web online.'});return false;}
  if(receiving||exporting||runtime.importing||runtime.deleting){res.status(409).json({error:'Bagian lain sedang diproses. Tunggu lalu lanjutkan.'});return false;}
  return true;
 };
 app.post('/api/admin/compact/start',requireAdmin,async(req,res)=>{
  if(!unlocked(res))return;
  receiving=true;
  try{
   const d=fs.statfsSync(directory);if(d.bavail*d.bsize<RESERVE+MAX_COMPRESSED)throw Object.assign(new Error('Ruang pengaman 512 MB belum tersedia.'),{status:507});
   const compressed=await receive(req),hash=req.headers['x-part-sha256'],part=decodePart(compressed,hash);
   const result=startCompact(getDb(),part,hash,Number(req.headers['x-total-parts']));
   runtime.compactSession=activeCompact(getDb());clearCache();json(res,result);
  }catch(e){fail(res,e);}finally{receiving=false;}
 });
 app.post('/api/admin/compact/import/:id/parts/:sequence',requireAdmin,async(req,res)=>{
  if(!unlocked(res))return;
  receiving=true;let writing=false;
  try{
   const s=compactStatus(getDb(),req.params.id);if(!s)throw Object.assign(new Error('Sesi tidak ditemukan.'),{status:404});
   const compressed=await receive(req),hash=req.headers['x-part-sha256'],part=decodePart(compressed,hash);
   if(part.id!==req.params.id||String(part.sequence)!==req.params.sequence)throw new Error('Identitas atau urutan bagian tidak cocok.');
   runtime.importing=true;writing=true;
   const result=await worker({action:'part',dbPath:path.resolve(getDbPath()),additionalPath:getAdditionalPath(),compressed,hash});
   runtime.compactSession=activeCompact(getDb());clearCache();json(res,result);
  }catch(e){fail(res,e);}finally{receiving=false;if(writing){runtime.importing=false;clearCache();}}
 });
 app.post('/api/admin/compact/import/:id/cancel',requireAdmin,async(req,res)=>{
  if(!unlocked(res))return;
  runtime.importing=true;
  try{const result=await worker({action:'cancel',dbPath:path.resolve(getDbPath()),id:req.params.id});runtime.compactSession=activeCompact(getDb());clearCache();json(res,result);}
  catch(e){fail(res,e);}finally{runtime.importing=false;}
 });
 // Do not expose page endpoints for a book that has not yet been published.
 app.use('/api/book/:id',(req,res,next)=>{
  if(!localExportMode&&runtime.compactSession){
   const row=getDb().prepare('SELECT current FROM compact_sessions WHERE id=?').get(runtime.compactSession);
   const current=JSON.parse(row?.current||'null');
   if(current&&!current.skip&&String(current.item.book.bkid)===req.params.id)return res.status(409).json({error:'Kitab ini masih dalam proses import.'});
  }next();
 });
 const timer=setInterval(()=>{
  for(const [id,job] of exports)if(job.finishedAt&&Date.now()-job.finishedAt>86400000&&!job.downloads){fs.rmSync(path.join(directory,id+'.mkt'),{force:true});fs.rmSync(path.join(directory,id+'.json'),{force:true});exports.delete(id);}
  // Interrupted exports have no downloadable ticket after restart and can be discarded.
  for(const file of fs.readdirSync(directory))if(/^[a-f0-9]{48}\.mkt$/.test(file)&&!exports.has(file.slice(0,-4))&&Date.now()-fs.statSync(path.join(directory,file)).mtimeMs>86400000)fs.rmSync(path.join(directory,file),{force:true});
 },3600000);timer.unref();
 return {close:()=>clearInterval(timer)};
}
