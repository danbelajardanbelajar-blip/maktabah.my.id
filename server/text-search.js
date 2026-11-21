import { Worker } from 'node:worker_threads';
import {searchScopeSql} from './search-scope.js';
// Full-text page search. Totals are counted only up to SEARCH_COUNT_CAP: an exact COUNT(*) of a common word
// (الله matches ~8 million pages) took minutes on the request thread and stalled every visitor meanwhile.
export const SEARCH_COUNT_CAP = 10000;

export const MAX_SEARCH_BOOKS = 100;

/**
 * @param db        better-sqlite3 connection (tambahan attached when `additional`)
 * @param options   {exactPhrase, andMatch, page, limit, catIds, bookId, bookIds, additional, excludedBookIds}
 *                  bookId / bookIds limit the search to those books (bookIds keeps the caller's order).
 * @returns         {results, total, capped}
 */
export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = 50, catIds = [], bookId = null, bookIds = [], additional = false, excludedBookIds = [], scope = null }) {
  const schemas = (additional ? ['main', 'tambahan'] : ['main'])
    .filter(schema => db.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE name='pages_fts' AND type='table'`).get());
  const offset = (page - 1) * limit;
  const selected = scope ? (!scope.all&&!scope.categories.length?scope.books:[]) : [...new Set([...(bookId ? [bookId] : []), ...bookIds])];
  if(scope)catIds=[];
  const scoped=searchScopeSql(scope);
  const filters = [], filterParams = [];
  // Book metadata may live in either library; a direct join per source keeps the primary-key lookup.
  const books = schema => additional
    ? { join: `LEFT JOIN main.books_meta bm ON bm.bkid=p.book_id LEFT JOIN tambahan.books_meta bt ON bt.bkid=p.book_id`, name: 'COALESCE(bm.bk,bt.bk)', cat: 'COALESCE(bm.cat,bt.cat)', exists: 'COALESCE(bm.bkid,bt.bkid) IS NOT NULL' }
    : { join: `JOIN ${schema}.books_meta b ON b.bkid=p.book_id`, name: 'b.bk', cat: 'b.cat', exists: '' };
  if (excludedBookIds && excludedBookIds.length && (!selected.length || scope)) {
    filters.push('p.book_id NOT IN (SELECT value FROM json_each(?))');
    filterParams.push(typeof excludedBookIds === 'string' ? excludedBookIds : JSON.stringify(excludedBookIds));
  }
  // main stays unqualified: older SQLite builds reject snippet() on a schema-qualified FTS table.
  const fts = schema => schema === 'main' ? 'pages_fts' : `${schema}.pages_fts`;
  const pagesTable = schema => schema === 'main' ? 'pages' : `${schema}.pages`;
  // A selected book's pages have consecutive rowids, so the FTS index is read only inside that rowid range.
  // Filtering by book_id after a MATCH instead walked every page of a common word (27 s for الله in 5 books).
  // p.book_id is still checked, so a book whose rowids are not consecutive stays correct, only slower.
  const ranges = schema => selected.map(id => ({ id, ...db.prepare(`SELECT min(rowid) a, max(rowid) b FROM ${pagesTable(schema)} WHERE book_id=?`).get(id) })).filter(r => r.a != null);
  const from = (schema, range) => {
    const meta = books(schema), where = ['pages_fts MATCH ?', ...(range ? ['pages_fts.rowid BETWEEN ? AND ?', 'p.book_id=?'] : []), ...filters, ...(scope?[searchScopeSql(scope,`COALESCE(${meta.cat},0)`,'p.book_id').sql]:[]), ...(catIds.length ? [`${meta.cat} IN (${catIds.map(() => '?').join(',')})`] : []), ...(meta.exists ? [meta.exists] : [])];
    return { sql: `FROM ${fts(schema)} JOIN ${pagesTable(schema)} p ON p.rowid=pages_fts.rowid ${meta.join} WHERE ${where.join(' AND ')}`, meta };
  };
  const params = (match, range) => [match, ...(range ? [range.a, range.b, range.id] : []), ...filterParams, ...scoped.params, ...catIds];
  const count = (schema, match, range, cap) => (!range && !filters.length && !catIds.length && scoped.sql==='(1)'
    // Without filters the FTS index alone answers; with filters the join is needed, still capped.
    ? db.prepare(`SELECT count(*) n FROM (SELECT 1 FROM ${fts(schema)} WHERE pages_fts MATCH ? LIMIT ${cap})`).get(match)
    : db.prepare(`SELECT count(*) n FROM (SELECT 1 ${from(schema, range).sql} LIMIT ${cap})`).get(...params(match, range))).n;
  const fetch = ({ schema, match, isExact, range }, take, skip) => {
    const { sql, meta } = from(schema, range);
    return db.prepare(`SELECT p.id AS page_id,p.book_id,p.part,p.page,${meta.name} AS book_name,snippet(pages_fts,-1,'<b>','</b>','...',15) AS snippet,${isExact ? 1 : 0} AS is_exact ${sql} LIMIT ? OFFSET ?`).all(...params(match, range), take, skip);
  };
  // Exact phrase hits first, then pages that contain all words elsewhere; each source in library order and,
  // with selected books, each book in the order chosen. Counting stops once the cap is passed: results beyond it
  // cannot be paged to anyway.
  const segments = [];
  let counted = 0, capped = false;
  for (const [match, isExact] of [[exactPhrase, true], [andMatch, false]]) {
    if (!match) continue;
    for (const schema of schemas) {
      for (const range of selected.length ? ranges(schema) : [null]) {
        if (counted > SEARCH_COUNT_CAP) { capped = true; break; }
        const total = count(schema, match, range, SEARCH_COUNT_CAP + 1 - counted);
        segments.push({ schema, match, isExact, range, total });
        counted += total;
      }
    }
  }
  capped = capped || counted > SEARCH_COUNT_CAP;
  const results = [];
  let skip = offset;
  for (const segment of segments) {
    if (results.length >= limit) break;
    const available = segment.total;
    if (skip >= available) { skip -= available; continue; }
    results.push(...fetch(segment, limit - results.length, skip));
    skip = 0;
  }
  return { results, total: Math.min(counted, SEARCH_COUNT_CAP), capped };
}

export const SEARCH_TIMEOUT = 20000;
const MAX_WORKERS = 4;
let activeWorkers = 0;
const fault = (message, code, status) => Object.assign(new Error(message), { code, status });

/**
 * Runs searchPages for file-backed libraries in a read-only worker, so a broad search can neither block other
 * visitors nor run longer than SEARCH_TIMEOUT. In-memory databases (tests) are searched in-process.
 */
export function searchPagesOffThread(db, options, { timeout = SEARCH_TIMEOUT } = {}) {
  const list = db.pragma('database_list');
  const main = list.find(row => row.name === 'main')?.file;
  const tambahan = options.additional ? list.find(row => row.name === 'tambahan')?.file : null;
  if (!main || (options.additional && !tambahan)) return Promise.resolve(searchPages(db, options));
  if (activeWorkers >= MAX_WORKERS) return Promise.reject(fault('Server sedang memproses banyak pencarian. Coba lagi beberapa saat lagi.', 'SEARCH_BUSY', 503));
  activeWorkers++;
  return new Promise((resolve, reject) => {
    let settled = false, timer;
    const worker = new Worker(new URL('./text-search-worker.js', import.meta.url), { workerData: { main, tambahan, options } });
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    worker.once('exit', () => { activeWorkers--; finish(fault('Pencarian belum dapat diselesaikan. Silakan coba lagi.', 'SEARCH_UNAVAILABLE', 503)); });
    worker.once('error', () => finish(fault('Pencarian belum dapat diselesaikan. Silakan coba lagi.', 'SEARCH_UNAVAILABLE', 503)));
    worker.once('message', message => finish(message.error ? fault('Pencarian belum dapat diselesaikan. Silakan coba lagi.', 'SEARCH_UNAVAILABLE', 503) : null, message.result));
    timer = setTimeout(() => finish(fault('Pencarian ini terlalu luas sehingga memerlukan waktu terlalu lama. Tambahkan kata yang lebih khusus atau gunakan tanda kutip untuk frasa.', 'SEARCH_TIMEOUT', 504)), timeout);
  });
}
