import { Worker } from 'node:worker_threads';
import { containsExcludedAiName, AI_BOOK_POLICY_VERSION, policySources } from './ai-book-policy.js';

let cachedExcludedIds = null;

/**
 * Creates table for tracking search exclusion status of books.
 * - excluded = 1: Book contains any of the excluded names/variants.
 * - excluded = 0: Book has been evaluated and confirmed clean.
 */
export function ensureSearchPolicySchema(stateDb) {
  stateDb.exec(`
    CREATE TABLE IF NOT EXISTS search_book_policy (
      bkid INTEGER PRIMARY KEY,
      excluded INTEGER NOT NULL,
      reason TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_search_policy_excluded ON search_book_policy(excluded);
  `);
  // policy_version: the AI_BOOK_POLICY_VERSION a row was decided under. fingerprint: the book's pages when it was
  // scanned (see search-policy-worker.js). A row with an older version or a different fingerprint is scanned again.
  try { stateDb.exec('ALTER TABLE search_book_policy ADD COLUMN policy_version TEXT'); } catch {}
  try { stateDb.exec('ALTER TABLE search_book_policy ADD COLUMN fingerprint TEXT'); } catch {}
}

const POLICY_UPSERT = 'INSERT OR REPLACE INTO search_book_policy (bkid, excluded, reason, updated_at, policy_version) VALUES (?, ?, ?, ?, ?)';

/**
 * Creates and populates temporary table on database connection for high-performance subqueries.
 */
export function ensureTempExcludedTable(db, ids) {
  if (!ids || !ids.length) return;
  db.exec('CREATE TEMP TABLE IF NOT EXISTS search_excluded_books (bkid INTEGER PRIMARY KEY); DELETE FROM temp.search_excluded_books;');
  const ins = db.prepare('INSERT INTO temp.search_excluded_books (bkid) VALUES (?)');
  db.transaction(() => {
    for (const id of ids) ins.run(id);
  })();
}

/**
 * Retrieve current set of excluded book IDs from cache or stateDb.
 */
export function getExcludedBookIds(stateDb) {
  if (cachedExcludedIds) return cachedExcludedIds;
  try {
    ensureSearchPolicySchema(stateDb);
    const rows = stateDb.prepare('SELECT bkid FROM search_book_policy WHERE excluded = 1').all();
    cachedExcludedIds = new Set(rows.map(r => r.bkid));
    return cachedExcludedIds;
  } catch {
    return new Set();
  }
}

export function invalidateSearchPolicyCache() {
  cachedExcludedIds = null;
}

/**
 * Fast synchronization of excluded books based on book titles and author names.
 * Runs in under 500ms even across 35,000 books.
 */
export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {}) {
  ensureSearchPolicySchema(stateDb);
  const schemas = hasTambahan ? ['main', 'tambahan'] : ['main'];
  const now = Date.now();
  const ins = stateDb.prepare(POLICY_UPSERT);

  stateDb.transaction(() => {
    for (const schema of schemas) {
      try {
        const books = db.prepare(`SELECT bkid, bk, authno FROM ${schema}.books_meta`).all();
        let badAuthors = new Set();
        try {
          const authors = db.prepare(`SELECT authid, auth FROM ${schema}.authors`).all();
          badAuthors = new Set(authors.filter(a => a.auth && containsExcludedAiName(a.auth)).map(a => a.authid));
        } catch {}

        for (const b of books) {
          if (b.bk && containsExcludedAiName(b.bk)) {
            ins.run(b.bkid, 1, 'title', now, AI_BOOK_POLICY_VERSION);
          } else if (b.authno && badAuthors.has(b.authno)) {
            ins.run(b.bkid, 1, 'author', now, AI_BOOK_POLICY_VERSION);
          }
        }
      } catch {}
    }
  })();

  cachedExcludedIds = null;
  return getExcludedBookIds(stateDb);
}

let activeScan = null, rescanRequested = false, lastScan = null;

/**
 * Scans the whole library in a worker (search-policy-worker.js) so ordinary search hides every book whose title,
 * author or page text names an excluded scholar, not only the ones an FTS sample found. Only books that are new,
 * changed, or decided under an older AI_BOOK_POLICY_VERSION are scanned; the first full scan of a large library
 * runs in the background for a while, later scans take seconds. Decisions are written as they arrive, so the
 * search filter improves during the scan; rows from earlier scans stay in force until their book is re-decided.
 * Resolves to a summary; a second call while a scan runs queues one more scan afterwards.
 */
export function startSearchPolicyScan(db, stateDb, { hasTambahan = false, pauseRatio = 1, batchSize = 25 } = {}) {
  if (activeScan) { rescanRequested = true; return activeScan.promise; }
  ensureSearchPolicySchema(stateDb);
  const sources = policySources(db, hasTambahan);
  if (sources.some(source => !source.file)) return Promise.reject(new Error('Pemindaian search policy memerlukan database berbasis file.'));
  const known = stateDb.prepare('SELECT bkid, fingerprint FROM search_book_policy WHERE policy_version = ? AND fingerprint IS NOT NULL')
    .all(AI_BOOK_POLICY_VERSION).map(r => [r.bkid, r.fingerprint]);
  const put = stateDb.prepare('INSERT OR REPLACE INTO search_book_policy (bkid, excluded, reason, updated_at, policy_version, fingerprint) VALUES (?, ?, ?, ?, ?, ?)');
  const progress = { version: AI_BOOK_POLICY_VERSION, running: true, startedAt: new Date().toISOString(), finishedAt: null, books: null, pending: null, scanned: 0, excluded: 0, error: null };
  const worker = new Worker(new URL('./search-policy-worker.js', import.meta.url), { workerData: { sources, known, pauseRatio, batchSize } });
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return; settled = true;
      progress.running = false; progress.finishedAt = new Date().toISOString(); progress.error = error?.message || null;
      void worker.terminate();
      if (error) reject(error); else resolve({ ...progress });
    };
    worker.on('message', message => {
      if (message.type === 'start') { progress.books = message.books; progress.pending = message.pending; }
      else if (message.type === 'batch') {
        try {
          const now = Date.now();
          stateDb.transaction(() => { for (const [id, reason, fingerprint] of message.results) put.run(id, reason ? 1 : 0, reason, now, AI_BOOK_POLICY_VERSION, fingerprint); })();
        } catch (error) { return finish(error); }
        progress.scanned += message.results.length;
        progress.excluded += message.results.filter(r => r[1]).length;
        cachedExcludedIds = null;
      }
      else if (message.type === 'done') finish(null);
      else if (message.type === 'error') finish(new Error(message.message));
    });
    worker.once('error', finish);
    worker.once('exit', () => finish(new Error('Worker search policy berhenti sebelum selesai.')));
  });
  activeScan = { worker, promise, progress };
  lastScan = progress;
  const next = () => {
    activeScan = null;
    if (rescanRequested) { rescanRequested = false; startSearchPolicyScan(db, stateDb, { hasTambahan, pauseRatio, batchSize }).catch(() => {}); }
  };
  promise.then(next, next);
  return promise;
}

/** Stops a running scan (used before the library file is swapped). Decisions already written are kept. */
export function stopSearchPolicyScan() { rescanRequested = false; void activeScan?.worker.terminate(); }

/** Progress of the running or last scan, for the status endpoint. */
export function searchPolicyScanStatus() { return lastScan ? { ...lastScan } : { version: AI_BOOK_POLICY_VERSION, running: false }; }

/** A page of this book was edited in place (same page count): scan it again on the next run. */
export function forgetSearchPolicyBook(stateDb, bookId) {
  try { stateDb.prepare('UPDATE search_book_policy SET fingerprint = NULL WHERE bkid = ?').run(bookId); } catch {}
}
