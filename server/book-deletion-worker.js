import Database from 'better-sqlite3';
import { parentPort, workerData } from 'node:worker_threads';
import { deleteCatalogue } from './book-deletion.js';

let db;
try {
  db = new Database(workerData.dbPath, { fileMustExist: true });
  db.pragma('busy_timeout=10000');
  db.pragma('journal_mode=WAL');
  db.pragma('cache_size=-16384');
  if (workerData.tafsirPath) db.prepare('ATTACH DATABASE ? AS tafsir').run(workerData.tafsirPath);
  if (workerData.additionalPath) db.prepare('ATTACH DATABASE ? AS tambahan').run(workerData.additionalPath);
  const deleted = deleteCatalogue(db, {
    ...workerData.selection, jobId: workerData.jobId,
    hasTafsir: Boolean(workerData.tafsirPath), hasAdditional: Boolean(workerData.additionalPath),
  }, progress => parentPort.postMessage({ progress }));
  parentPort.postMessage({ deleted });
} catch (error) { parentPort.postMessage({ error: error.message }); }
finally { db?.close(); }
