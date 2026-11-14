import {parentPort,workerData} from 'node:worker_threads';
import Database from 'better-sqlite3';
import {scanAiBooks} from './ai-book-policy.js';

let db;
try {
  const excluded=new Map(workerData.ids.map(id=>[id,false]));
  for (const source of workerData.sources) {
    if (!['main','tambahan'].includes(source.schema)) throw Error('Invalid schema');
    db=new Database(source.file,{readonly:true,fileMustExist:true,timeout:2000});
    db.pragma('query_only=ON');
    for (const [id,blocked] of scanAiBooks(db,workerData.ids.filter(id=>!excluded.get(id)))) {
      if (blocked) excluded.set(id,true);
    }
    db.close();db=null;
  }
  parentPort.postMessage({results:[...excluded]});
} catch { parentPort.postMessage({error:true}); }
finally { db?.close(); }
