import {parentPort,workerData} from 'node:worker_threads';
import Database from 'better-sqlite3';
import {containsExcludedAiName,policyBody} from './ai-book-policy.js';

// Full-library scan for the search policy (started by startSearchPolicyScan in search-policy.js).
// Opens every library file read-only, decides each book that is new, changed or decided under an older policy
// version, and posts the decisions in batches. After each book it pauses for `pauseRatio` times the time that
// book took, so a long first scan leaves CPU and disk to visitors.
const {sources,known,pauseRatio=1,batchSize=25}=workerData;
const pause=ms=>{if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};
const dbs=[];
try {
  for (const source of sources) {
    if (!['main','tambahan'].includes(source.schema)) throw Error('Invalid schema');
    const db=new Database(source.file,{readonly:true,fileMustExist:true,timeout:5000});
    db.pragma('query_only=ON');dbs.push(db);
  }
  // Titles and author names per book, from every source the ID appears in.
  const meta=new Map();
  for (const db of dbs) {
    const hasAuthors=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='authors'").get();
    const sql=hasAuthors?'SELECT b.bkid,b.bk,a.auth FROM books_meta b LEFT JOIN authors a ON a.authid=b.authno':'SELECT bkid,bk,NULL auth FROM books_meta';
    for (const r of db.prepare(sql).iterate()) meta.set(r.bkid,[...(meta.get(r.bkid)||[]),r.bk,r.auth]);
  }
  // Fingerprint per book: page count and highest rowid in each source. Importing or deleting pages changes it,
  // so only those books are scanned again. In-place page edits are reported by the server (forgetSearchPolicyBook).
  const fingerprints=new Map();
  dbs.forEach((db,i)=>{
    for (const r of db.prepare('SELECT book_id,count(*) c,max(rowid) m FROM pages GROUP BY book_id').iterate()) {
      fingerprints.set(r.book_id,`${fingerprints.get(r.book_id)||''}${i}:${r.c}:${r.m};`);
    }
  });
  const decided=new Map(known);
  const pending=[...meta.keys()].filter(id=>decided.get(id)!==(fingerprints.get(id)||'')).sort((a,b)=>a-b);
  parentPort.postMessage({type:'start',books:meta.size,pending:pending.length});
  const pages=dbs.map(db=>db.prepare('SELECT nass FROM pages WHERE book_id=?'));
  let batch=[];
  for (const id of pending) {
    const started=Date.now(),names=meta.get(id);
    let reason=null;
    for (let i=0;i<names.length&&!reason;i+=2) {
      if (names[i]&&containsExcludedAiName(names[i])) reason='title';
      else if (names[i+1]&&containsExcludedAiName(names[i+1])) reason='author';
    }
    if (!reason) scan: for (const statement of pages) {
      for (const page of statement.iterate(id)) {
        if (containsExcludedAiName(policyBody(page.nass))) { reason='content'; break scan; }
      }
    }
    batch.push([id,reason,fingerprints.get(id)||'']);
    if (batch.length>=batchSize) { parentPort.postMessage({type:'batch',results:batch}); batch=[]; }
    pause(Math.min(2000,(Date.now()-started)*pauseRatio));
  }
  if (batch.length) parentPort.postMessage({type:'batch',results:batch});
  parentPort.postMessage({type:'done'});
} catch (error) {
  parentPort.postMessage({type:'error',message:error.message});
} finally {
  for (const db of dbs) db.close();
}
