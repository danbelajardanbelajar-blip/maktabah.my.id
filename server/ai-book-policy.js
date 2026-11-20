import {Worker} from 'node:worker_threads';
import {sourceText} from './ai-source.js';

// Changing the names or patterns: bump the version. It renews the AI answer cache namespace and makes
// search-policy.js re-check every book it stored as excluded under an older version.
export const AI_BOOK_POLICY_VERSION = 'whole-book-exclusions-v8';
// ابن تيمية was removed from the list in v5 at the owner's request: his name and books are no longer excluded.
// v6 narrowed البازي/البازية to البازية, because البازي (the falcon) excluded books that never name Ibn Baz.
// v7, at the owner's request, stopped excluding the adjectives البازية/البازيه and الألبانية/الالبانيه.
// v8, at the owner's request, excludes the full title phrase شيخ الإسلام ابن تيمية (with or without hamza);
// ابن تيمية on its own stays allowed.
export const excludedAiNames = ['ابن باز','ابن عثيمين','الألباني','شيخ الإسلام ابن تيمية'];
// Patterns run on normalized text: no marks/tatweel, أإآٱ→ا, ة→ه, ى→ي, punctuation→space.
// A word may carry the proclitics و ف ب ل ك (لابن باز، وابن باز، للألباني); ابن may be written بن.
const START = '(?:^|\\s)[وفبلك]{0,2}', END = '(?=\\s|$)';
const patterns = [
  `${START}ا?بن\\s*باز${END}`,                       // ابن باز، بن باز، عبد العزيز بن باز
  'عثيمين',                                          // ابن عثيمين، العثيمين، عثيمين
  `${START}ا?لالباني${END}`,                         // الألباني، للألباني، والألباني (not الباني "the builder", not الألبانية)
  `${START}شيخ\\s+الاسلام\\s+ا?بن\\s*تيميه${END}`,     // شيخ الإسلام ابن تيمية، شيخ الاسلام ابن تيمية، لشيخ الإسلام بن تيمية
].map(source=>new RegExp(source,'u'));
export const normalizePolicyText = text => sourceText(text).normalize('NFKC')
  .replace(/[\p{M}\p{Cf}ـ]/gu,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
// An editor's footnotes (below the '______' rule) are not the book's own text: a hadith grading that cites
// one of the names must not exclude the whole book. The quoted excerpt itself is still checked in full.
export const policyBody = text => sourceText(text).split(/_{4,}/u)[0];
// Fast pre-check, about 1.5x faster on whole books: every pattern above needs one of these letter runs, which
// survive in the raw text once marks are dropped and alif/ta/ya are folded. Text that the full normalization
// could still rewrite into Arabic letters (HTML, entities, presentation forms) always takes the full path.
// Adding a pattern: add its fixed letter run here too (the tests fail otherwise).
const FULL_PATH = /[<&\u{0675}-\u{0678}\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}\u{1EE00}-\u{1EEFF}]/u, LETTER_RUNS = /باز|عثيمين|لالباني|تيميه/;
const mayContainExcludedName = text => FULL_PATH.test(text) ||
  LETTER_RUNS.test(text.replace(/[\p{M}\p{Cf}ـ]/gu,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي'));
export const containsExcludedAiName = text => {
  if (!mayContainExcludedName(String(text??''))) return false;
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
        if (containsExcludedAiName(policyBody(page.nass))) return [id,true];
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

// Database files of the main library (and the attached additional one), for read-only background workers.
export const policySources = (db, additional=false) => databaseState(db,additional).sources;

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
  return references.filter(reference=>state.books.get(reference.bkid)===false&&!containsExcludedAiName(reference.excerpt||''));
}

export async function assertAllowedAiBook(db, reference, additional=false, options) {
  if (!(await filterAllowedAiReferences(db,[reference],additional,options)).length) {
    throw fault('Kitab atau halaman ini dikecualikan dari rujukan AI karena teksnya memuat nama yang termasuk daftar pengecualian.','AI_SOURCE_EXCLUDED',403);
  }
}
