import {parentPort,workerData} from 'node:worker_threads';
import {exportCompact,prepareCompactDb,decodePart,applyCompact,cancelCompact,ensureCompactSchema} from './compact-transfer-core.js';
import Database from 'better-sqlite3';
try{
 let result;
 if(workerData.action==='export')result=exportCompact(workerData,p=>parentPort.postMessage({type:'progress',data:p}));
 else{
  const db=prepareCompactDb(workerData.dbPath);let extra;
  try{
   ensureCompactSchema(db);
   if(workerData.additionalPath)extra=new Database(workerData.additionalPath,{readonly:true,fileMustExist:true});
   result=workerData.action==='cancel'?cancelCompact(db,workerData.id):applyCompact(db,decodePart(workerData.compressed,workerData.hash),workerData.hash,id=>!!extra?.prepare('SELECT 1 FROM books_meta WHERE bkid=?').get(id));
   db.pragma('wal_checkpoint(PASSIVE)');
  }finally{extra?.close();db.close();}
 }
 parentPort.postMessage({type:'done',result});
}catch(e){
 const disk=e.code==='SQLITE_FULL',busy=e.code==='SQLITE_BUSY';
 parentPort.postMessage({type:'failed',error:disk?'Disk penuh. Bagian aktif dibatalkan; kosongkan ruang lalu lanjutkan dari status tersimpan.':busy?'Database sedang dipakai. Tunggu sebentar lalu lanjutkan import.':e.message,status:disk?507:busy?409:e.status||400});
}
