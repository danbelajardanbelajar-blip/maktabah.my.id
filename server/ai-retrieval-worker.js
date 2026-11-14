import {parentPort,workerData} from 'node:worker_threads';
import Database from 'better-sqlite3';
import {retrieveAiCandidates} from './ai-retrieval.js';

// Source libraries are opened read-only; ATTACH inherits the read-only open flags of the main connection.
let db;
try {
  db=new Database(workerData.main,{readonly:true,fileMustExist:true,timeout:2000});
  db.pragma('query_only=ON');
  if (workerData.tambahan) db.prepare('ATTACH DATABASE ? AS tambahan').run(workerData.tambahan);
  parentPort.postMessage({candidates:retrieveAiCandidates(db,...workerData.args)});
} catch { parentPort.postMessage({error:true}); }
finally { db?.close(); }
