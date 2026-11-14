import {Worker} from 'node:worker_threads';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {activeHadithIndex} from './hadith-search-core.js';
export function registerHadithSearch(app,{getPaths,isBusy=()=>false,directory,onActivity=()=>{}}) {
  let active=0,building=false,progress=null,buildError='',failedAt=0;
  fs.mkdirSync(directory,{recursive:true});
  const startBuild=()=>{
    if(building||isBusy()||!getPaths().length)return;
    building=true;buildError='';progress={pages:0};const dirtyFile=path.join(directory,'dirty'),token=fs.existsSync(dirtyFile)?fs.readFileSync(dirtyFile,'utf8'):null;
    const worker=new Worker(new URL('./hadith-search-worker.js',import.meta.url),{workerData:{action:'build',paths:getPaths(),directory}});
    worker.on('message',message=>{if(message.progress)progress=message.progress;else if(message.error)buildError='Indeks belum dapat disiapkan. Silakan coba lagi.';else if((fs.existsSync(dirtyFile)?fs.readFileSync(dirtyFile,'utf8'):null)===token)fs.rmSync(dirtyFile,{force:true});});
    worker.once('error',()=>{buildError='Indeks belum dapat disiapkan. Silakan coba lagi.';});
    worker.once('exit',()=>{building=false;if(buildError)failedAt=Date.now();});
  };
  const preparing=res=>res.status(202).set('Cache-Control','no-store').json({preparing:true,message:`Menyiapkan indeks Kutub Hadis${progress?.pages?` · ${progress.pages.toLocaleString('id-ID')} halaman`:''}. Pencarian akan dilanjutkan otomatis.`});
  app.get('/api/hadith-books/search',(req,res)=>{
    if(isBusy())return res.status(409).json({error:'Pencarian sementara tidak tersedia selama pembaruan database. Silakan coba lagi setelah selesai.'});
    if(building)return preparing(res);
    if(active>=2)return res.status(429).json({error:'Pencarian sedang sibuk. Tunggu sebentar lalu coba lagi.'});
    const paths=getPaths();if(!paths.length)return res.status(503).json({error:'Database kitab belum tersedia.'});
    const indexPath=activeHadithIndex(directory);
    if(!indexPath){if(buildError&&Date.now()-failedAt<30000)return res.status(503).json({error:buildError+' Tunggu sebentar sebelum mencoba lagi.'});startBuild();return preparing(res);}
    const worker=new Worker(new URL('./hadith-search-worker.js',import.meta.url),{workerData:{paths,query:req.query,indexPath}});active++;
    let settled=false;
    const stop=()=>{clearTimeout(timer);void worker.terminate();};
    const finish=(status,data)=>{if(settled)return;settled=true;res.status(status).set('Cache-Control','no-store').json(data);stop();};
    const timer=setTimeout(()=>finish(504,{error:'Pencarian memerlukan waktu lebih lama. Tambahkan kata, pilih satu kitab atau edisi, lalu coba lagi.'}),15000);
    res.once('close',()=>{if(!settled){settled=true;stop();}});
    worker.once('message',message=>{
      if(message.code==='HADITH_INDEX_STALE'){if(!settled){settled=true;fs.writeFileSync(path.join(directory,'dirty'),crypto.randomUUID());startBuild();preparing(res);stop();}return;}
      if(!message.error&&!settled)try{onActivity(req,{action:'search',query:message.result.q,result_count:message.result.results.length,
        context:{mode:'content',...message.result.scope,group_name:message.result.scope.name,matching:message.result.matching,page:message.result.page,has_more:message.result.hasMore}});}catch{/* Optional analytics. */}
      finish(message.error?message.status:200,message.error?{error:message.error}:message.result);
    });
    worker.once('error',()=>finish(503,{error:'Pencarian belum dapat diselesaikan. Silakan coba lagi.'}));
    worker.once('exit',()=>{active--;if(!settled)finish(503,{error:'Pencarian terhenti. Silakan coba lagi.'});});
  });
  // The index is a derived cache; source book databases are always read-only.
  if(!activeHadithIndex(directory))startBuild();
  return()=>{fs.writeFileSync(path.join(directory,'dirty'),crypto.randomUUID());};
}
