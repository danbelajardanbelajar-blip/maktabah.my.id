import {Worker} from 'node:worker_threads';
import {sourceText} from './ai-source.js';

export const AI_BOOK_POLICY_VERSION = 'whole-book-exclusions-v1';
export const excludedAiNames = ['بن باز','عثيمين','محمد بن عبد الوهاب','ابن تيمية'];
const patterns = excludedAiNames.map(name=>new RegExp(name.split(' ').join('\\s*'),'u'));
export const normalizePolicyText = text => sourceText(text).normalize('NFKC')
  .replace(/[\p{M}\p{Cf}\u0640]/gu,'').replace(/[أإآٱ]/g,'ا')
  .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export const containsExcludedAiName = text => {
  const normalized = normalizePolicyText(text);
  return patterns.some(pattern=>pattern.test(normalized));
};
const fault = (message,code='AI_SOURCE_CHECK_UNAVAILABLE',status=503) => Object.assign(new Error(message),{code,status});
const unavailable = () => fault('Pemeriksaan kelayakan kitab belum dapat diselesaikan. Silakan coba lagi.');
const states = new WeakMap();
let activeWorkers = 0;

// Called for every application content mutation. Logs and analytics do not invalidate this cache.
export function invalidateAiBookPolicy(db) { if (db) states.delete(db); }

export function scanAiBooks(db, bookIds, schemas=['main']) {
  return bookIds.map(id=>{
    for (const schema of schemas) {
      if (!['main','tambahan'].includes(schema)) throw unavailable();
      for (const page of db.prepare(`SELECT nass FROM ${schema}.pages WHERE book_id=?`).iterate(id)) {
        if (containsExcludedAiName(page.nass)) return [id,true];
      }
    }
    return [id,false];
  });
}

function databaseState(db, additional) {
  const schemas = additional ? ['main','tambahan'] : ['main'];
  const databases = db.pragma('database_list');
  const sources = schemas.map(schema=>{
    const source = databases.find(row=>row.name===schema);
    if (!source) throw unavailable();
    return {schema,file:source.file,version:db.pragma(`${schema}.data_version`,{simple:true}),schemaVersion:db.pragma(`${schema}.schema_version`,{simple:true})};
  });
  return {schemas,sources,signature:JSON.stringify(sources)};
}

function workerScan(sources, ids, signal) {
  if (activeWorkers >= 2) return Promise.reject(unavailable());
  activeWorkers++;
  return new Promise((resolve,reject)=>{
    let worker, timer, settled=false;
    const cancel = () => finish(fault('Permintaan dibatalkan.','CANCELLED',499));
    const finish = (error,value) => {
      if (settled) return; settled=true;
      clearTimeout(timer);signal?.removeEventListener('abort',cancel);
      if (worker) void worker.terminate();
      else activeWorkers--;
      if (error) reject(error); else resolve(value);
    };
    try {
      if (signal?.aborted) return finish(fault('Permintaan dibatalkan.','CANCELLED',499));
      worker=new Worker(new URL('./ai-book-policy-worker.js',import.meta.url),{workerData:{sources,ids}});
      worker.once('exit',()=>{activeWorkers--;finish(unavailable());});
      worker.once('error',()=>finish(unavailable()));
      worker.once('message',message=>finish(message.error ? unavailable() : null,message.results));
      timer=setTimeout(()=>finish(unavailable()),20000);
      signal?.addEventListener('abort',cancel,{once:true});
    } catch { finish(unavailable()); }
  });
}

export async function filterAllowedAiReferences(db, references, additional=false, {signal}={}) {
  if (!Array.isArray(references) || references.length > 8) throw unavailable();
  if (!references.length) return [];
  if (signal?.aborted) throw fault('Permintaan dibatalkan.','CANCELLED',499);
  const ids=[...new Set(references.map(reference=>reference.bkid))];
  if (ids.some(id=>!Number.isSafeInteger(id)||id<1)) throw unavailable();
  const initial=databaseState(db,additional);
  let state=states.get(db);
  if (!state || state.signature!==initial.signature) {
    state={signature:initial.signature,books:new Map()};states.set(db,state);
  }
  const missing=ids.filter(id=>!state.books.has(id));
  if (missing.length) {
    // In-memory databases are used by tests; live file-backed libraries are scanned read-only off-thread.
    const results=initial.sources.some(source=>!source.file)
      ? scanAiBooks(db,missing,initial.schemas)
      : await workerScan(initial.sources,missing,signal);
    if (states.get(db)!==state || databaseState(db,additional).signature!==initial.signature) {
      throw fault('Isi kitab berubah saat pemeriksaan rujukan. Silakan kirim pertanyaan kembali.','AI_SOURCE_CHANGED');
    }
    for (const [id,excluded] of results) {
      if (state.books.size>=2048) state.books.delete(state.books.keys().next().value);
      state.books.set(id,excluded);
    }
  }
  return references.filter(reference=>state.books.get(reference.bkid)===false);
}

export async function assertAllowedAiBook(db, reference, additional=false, options) {
  if (!(await filterAllowedAiReferences(db,[reference],additional,options)).length) {
    throw fault('Kitab ini dikecualikan dari rujukan AI karena salah satu halamannya memuat nama yang termasuk daftar pengecualian.','AI_SOURCE_EXCLUDED',403);
  }
}
