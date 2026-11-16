import { Worker } from 'node:worker_threads';
// Full-text page search. Totals are counted only up to SEARCH_COUNT_CAP: an exact COUNT(*) of a common word
// (الله matches ~8 million pages) took minutes on the request thread and stalled every visitor meanwhile.
export const SEARCH_COUNT_CAP = 10000;

/**
 * @param db        better-sqlite3 connection (tambahan attached when `additional`)
 * @param options   {exactPhrase, andMatch, page, limit, catIds, bookId, additional}
 * @returns         {results, total, capped}
 */
export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = 50, catIds = [], bookId = null, additional = false, excludedBookIds = [] }) {
  const schemas = (additional ? ['main', 'tambahan'] : ['main'])
    .filter(schema => db.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE name='pages_fts' AND type='table'`).get());
  const offset = (page - 1) * limit;
  const filters = [], filterParams = [];
  // Book metadata may live in either library; a direct join per source keeps the primary-key lookup.
  const books = schema => additional
    ? { join: `LEFT JOIN main.books_meta bm ON bm.bkid=p.book_id LEFT JOIN tambahan.books_meta bt ON bt.bkid=p.book_id`, name: 'COALESCE(bm.bk,bt.bk)', cat: 'COALESCE(bm.cat,bt.cat)', exists: 'COALESCE(bm.bkid,bt.bkid) IS NOT NULL' }
    : { join: `JOIN ${schema}.books_meta b ON b.bkid=p.book_id`, name: 'b.bk', cat: 'b.cat', exists: '' };
  if (bookId) { filters.push('p.book_id=?'); filterParams.push(bookId); }
  if (excludedBookIds && excludedBookIds.length && !bookId) {
    filters.push('p.book_id NOT IN (SELECT value FROM json_each(?))');
    filterParams.push(typeof excludedBookIds === 'string' ? excludedBookIds : JSON.stringify(excludedBookIds));
  }
  // main stays unqualified: older SQLite builds reject snippet() on a schema-qualified FTS table.
  const fts = schema => schema === 'main' ? 'pages_fts' : `${schema}.pages_fts`;
  const from = schema => {
    const meta = books(schema), where = ['pages_fts MATCH ?', ...filters, ...(catIds.length ? [`${meta.cat} IN (${catIds.map(() => '?').join(',')})`] : []), ...(meta.exists ? [meta.exists] : [])];
    return { sql: `FROM ${fts(schema)} JOIN ${schema === 'main' ? 'pages' : `${schema}.pages`} p ON p.rowid=pages_fts.rowid ${meta.join} WHERE ${where.join(' AND ')}`, meta };
  };
  const params = match => [match, ...filterParams, ...catIds];
  const count = (schema, match) => (!filters.length && !catIds.length
    // Without filters the FTS index alone answers; with filters the join is needed, still capped.
    ? db.prepare(`SELECT count(*) n FROM (SELECT 1 FROM ${fts(schema)} WHERE pages_fts MATCH ? LIMIT ${SEARCH_COUNT_CAP + 1})`).get(match)
    : db.prepare(`SELECT count(*) n FROM (SELECT 1 ${from(schema).sql} LIMIT ${SEARCH_COUNT_CAP + 1})`).get(...params(match))).n;
  const fetch = (schema, match, isExact, take, skip) => {
    const { sql, meta } = from(schema);
    return db.prepare(`SELECT p.id AS page_id,p.book_id,p.part,p.page,${meta.name} AS book_name,snippet(pages_fts,-1,'<b>','</b>','...',15) AS snippet,${isExact ? 1 : 0} AS is_exact ${sql} LIMIT ? OFFSET ?`).all(...params(match), take, skip);
  };
  // Exact phrase hits first, then pages that contain all words elsewhere; each source in library order.
  const segments = [];
  for (const [match, isExact] of [[exactPhrase, true], [andMatch, false]]) {
    if (!match) continue;
    for (const schema of schemas) segments.push({ schema, match, isExact, total: count(schema, match) });
  }
  const sum = segments.reduce((n, s) => n + Math.min(s.total, SEARCH_COUNT_CAP), 0);
  const capped = segments.some(s => s.total > SEARCH_COUNT_CAP) || sum > SEARCH_COUNT_CAP;
  const results = [];
  let skip = offset;
  for (const segment of segments) {
    if (results.length >= limit) break;
    const available = Math.min(segment.total, SEARCH_COUNT_CAP);
    if (skip >= available) { skip -= available; continue; }
    results.push(...fetch(segment.schema, segment.match, segment.isExact, limit - results.length, skip));
    skip = 0;
  }
  return { results, total: Math.min(sum, SEARCH_COUNT_CAP), capped };
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
