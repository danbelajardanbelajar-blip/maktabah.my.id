import {Worker} from 'node:worker_threads';
import {matchesQuestionTopic,topicSearchConstraint} from './ai-relevance.js';

// Ranking only rowids first keeps snippet() work to the top candidates; computing snippets for every
// match of a common word (hundreds of thousands of pages) blocked the server for more than a minute.
export const AI_CANDIDATE_LIMIT = 60;
export const AI_RETRIEVAL_TIMEOUT = 20000;
const clean = text => String(text ?? '').replace(/<[^>]*>/g, '').replace(/[ً-ٰٟ]/g, '').trim();
const ignored = new Set('apa apakah siapa bagaimana kapan mengapa kenapa dimana berapa jelaskan tolong tentang menurut referensi kitab tersedia dalam dari untuk yang dan dengan hukum saya ini itu ada what how the is of in من ما هل عن في على إلى هو هي هذا هذه حكم'.split(' '));
export const searchTerms = text => [...new Set(clean(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !ignored.has(w)))].slice(0, 8);
const fault = (message, code, status) => Object.assign(new Error(message), { code, status });
export const searchTimeout = () => fault('Pencarian rujukan untuk pertanyaan ini terlalu luas sehingga memerlukan waktu lebih lama. Tambahkan kata kunci yang lebih spesifik, misalnya judul kitab, bab, atau mazhab, lalu coba lagi.', 'AI_SEARCH_TIMEOUT', 504);
const searchUnavailable = () => fault('Pencarian rujukan kitab belum dapat diselesaikan. Silakan coba lagi.', 'AI_SEARCH_UNAVAILABLE', 503);

/** Candidate pool for one question: ranked pages (and catalogue books), without policy exclusions applied. */
export function retrieveAiCandidates(db, question, additional = false, catalogue = false, focusQuestion = question) {
  const terms = searchTerms(question);
  if (!terms.length) return [];
  const constraint = catalogue ? '' : topicSearchConstraint(focusQuestion);
  const schemas = additional ? ['main', 'tambahan'] : ['main'];
  const pages = [];
  for (const schema of schemas) {
    if (!db.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE name='pages_fts' AND type='table'`).get()) continue;
    const rank = db.prepare(`SELECT rowid,bm25(pages_fts) AS score FROM ${schema}.pages_fts WHERE pages_fts MATCH ? ORDER BY bm25(pages_fts) LIMIT ${AI_CANDIDATE_LIMIT}`);
    // SQLite 3.53 FTS5 ignores a bound `rowid=?` next to MATCH (it returned the first match instead),
    // so the lookup uses a one-row BETWEEN range and the returned rowid is checked.
    const snippet = db.prepare(`SELECT rowid,snippet(pages_fts,0,'','',' … ',80) AS excerpt FROM ${schema}.pages_fts WHERE pages_fts MATCH ? AND rowid BETWEEN ? AND ?`);
    const detail = db.prepare(`SELECT b.bkid,b.bk AS title,p.id AS pageId,p.part AS juz,p.page
      FROM ${schema}.pages p JOIN ${schema}.books_meta b ON b.bkid=p.book_id WHERE p.rowid=?`);
    for (const join of [' AND ', ' OR ']) {
      const match = '(' + terms.map(t => `"${t}"`).join(join) + ')' + (constraint ? ' AND ' + constraint : '');
      const relevant = [];
      for (const { rowid, score } of rank.all(match)) {
        const row = detail.get(rowid), found = snippet.get(match, rowid, rowid);
        if (!row || found?.rowid !== rowid) continue;
        const excerpt = clean(found.excerpt).slice(0, 1800);
        if (matchesQuestionTopic(excerpt, focusQuestion)) relevant.push({ ...row, excerpt, score });
      }
      pages.push(...relevant);
      if (relevant.length || terms.length === 1) break;
    }
  }
  pages.sort((a, b) => a.score - b.score);
  const books = [];
  if (catalogue) {
    for (const schema of schemas) {
      const rows = db.prepare(`SELECT bkid,bk AS title FROM ${schema}.books_meta WHERE (${terms.map(() => 'bk LIKE ?').join(' OR ')}) LIMIT 20`).all(...terms.map(t => `%${t}%`));
      books.push(...rows.map(r => ({ ...r, pageId: null, juz: null, page: null, excerpt: `Informasi katalog: kitab berjudul "${clean(r.title)}" tersedia di perpustakaan. Metadata ini hanya memastikan keberadaan kitab, bukan kutipan isi atau dasar hukum.` })));
    }
  }
  return [...books, ...pages.map(({ score: _score, ...r }) => r)];
}

/** Picks at most 8 references from a candidate pool, skipping excluded books and keeping ≤3 pages per book. */
export function selectAiReferences(candidates, catalogue = false, excludedBooks = []) {
  const excluded = new Set(excludedBooks);
  const seen = new Set(), perBook = new Map();
  const pages = candidates.filter(r => r.pageId != null && !excluded.has(r.bkid)).filter(r => {
    const id = `${r.bkid}:${r.pageId}`;
    if (seen.has(id) || (perBook.get(r.bkid) || 0) >= 3) return false;
    seen.add(id); perBook.set(r.bkid, (perBook.get(r.bkid) || 0) + 1); return true;
  }).slice(0, 8);
  if (!catalogue) return pages;
  const books = candidates.filter(r => r.pageId == null && !excluded.has(r.bkid)).slice(0, 5);
  return [...books, ...pages].filter((r, i, all) => all.findIndex(x => x.bkid === r.bkid && x.pageId === r.pageId) === i).slice(0, 8);
}

export function retrieveAiReferences(db, question, additional = false, catalogue = false, focusQuestion = question, excludedBooks = []) {
  return selectAiReferences(retrieveAiCandidates(db, question, additional, catalogue, focusQuestion), catalogue, excludedBooks);
}

/**
 * Runs retrieval for file-backed libraries in a read-only worker so the HTTP server keeps streaming
 * progress and serving other visitors. In-memory databases (tests) are searched in-process.
 */
export function retrieveAiCandidatesOffThread(db, [question, additional = false, catalogue = false, focusQuestion = question], { signal, timeout = AI_RETRIEVAL_TIMEOUT } = {}) {
  const list = db.pragma('database_list');
  const main = list.find(row => row.name === 'main')?.file;
  const tambahan = additional ? list.find(row => row.name === 'tambahan')?.file : null;
  if (!main || (additional && !tambahan)) return Promise.resolve(retrieveAiCandidates(db, question, additional, catalogue, focusQuestion));
  return new Promise((resolve, reject) => {
    let worker, timer, settled = false;
    const cancel = () => finish(fault('Permintaan dibatalkan.', 'CANCELLED', 499));
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (worker) void worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    try {
      if (signal?.aborted) return cancel();
      if (timeout <= 0) return finish(searchTimeout());
      worker = new Worker(new URL('./ai-retrieval-worker.js', import.meta.url), { workerData: { main, tambahan, args: [question, additional, catalogue, focusQuestion] } });
      worker.once('message', message => finish(message.error ? searchUnavailable() : null, message.candidates));
      worker.once('error', () => finish(searchUnavailable()));
      worker.once('exit', () => finish(searchUnavailable()));
      timer = setTimeout(() => finish(searchTimeout()), timeout);
      signal?.addEventListener('abort', cancel, { once: true });
    } catch { finish(searchUnavailable()); }
  });
}
