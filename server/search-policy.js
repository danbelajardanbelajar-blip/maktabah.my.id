import { containsExcludedAiName, policyBody, AI_BOOK_POLICY_VERSION, scanBooksOffThread } from './ai-book-policy.js';

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
  // policy_version: the AI_BOOK_POLICY_VERSION a row was decided under. Rows from an older version are re-checked
  // by reconcileSearchPolicyBatch, so a name removed from the list stops hiding books it used to hide.
  try { stateDb.exec('ALTER TABLE search_book_policy ADD COLUMN policy_version TEXT'); } catch {}
}

const POLICY_UPSERT = 'INSERT OR REPLACE INTO search_book_policy (bkid, excluded, reason, updated_at, policy_version) VALUES (?, ?, ?, ?, ?)';

function metadataReason(db, schemas, bkid) {
  for (const schema of schemas) {
    let meta = null;
    try { meta = db.prepare(`SELECT bk, authno FROM ${schema}.books_meta WHERE bkid = ?`).get(bkid); } catch {}
    if (meta?.bk && containsExcludedAiName(meta.bk)) return 'title';
    if (meta?.authno) {
      let author = null;
      try { author = db.prepare(`SELECT auth FROM ${schema}.authors WHERE authid = ?`).get(meta.authno); } catch {}
      if (author?.auth && containsExcludedAiName(author.auth)) return 'author';
    }
  }
  return null;
}

/**
 * Re-checks up to `limit` books stored as excluded under an older policy version and resolves to how many such
 * books remain. Books that no longer match are released (excluded = 0). Once none remain, clean rows from older
 * versions are deleted so a newly added name is evaluated again by the regular scans.
 * Page text is scanned off-thread (a book such as مجموع الفتاوى has ~17,000 pages and takes seconds), so the
 * server keeps answering requests. A failed or timed-out scan rejects and releases nothing.
 */
export async function reconcileSearchPolicyBatch(db, stateDb, { hasTambahan = false, limit = 2 } = {}) {
  ensureSearchPolicySchema(stateDb);
  const schemas = hasTambahan ? ['main', 'tambahan'] : ['main'];
  const stale = "excluded = 1 AND COALESCE(policy_version, '') <> ?";
  const rows = stateDb.prepare(`SELECT bkid FROM search_book_policy WHERE ${stale} ORDER BY bkid LIMIT ?`).all(AI_BOOK_POLICY_VERSION, limit);
  if (!rows.length) {
    stateDb.prepare("DELETE FROM search_book_policy WHERE excluded = 0 AND COALESCE(policy_version, '') <> ?").run(AI_BOOK_POLICY_VERSION);
    return 0;
  }
  const reasons = new Map(rows.map(r => [r.bkid, metadataReason(db, schemas, r.bkid)]));
  const unresolved = rows.map(r => r.bkid).filter(id => !reasons.get(id));
  if (unresolved.length) {
    for (const [id, blocked] of await scanBooksOffThread(db, unresolved, hasTambahan)) reasons.set(id, blocked ? 'content' : null);
  }
  const put = stateDb.prepare(POLICY_UPSERT), now = Date.now();
  stateDb.transaction(() => { for (const [bkid, reason] of reasons) put.run(bkid, reason ? 1 : 0, reason, now, AI_BOOK_POLICY_VERSION); })();
  cachedExcludedIds = null;
  return stateDb.prepare(`SELECT COUNT(*) n FROM search_book_policy WHERE ${stale}`).get(AI_BOOK_POLICY_VERSION).n;
}

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

/**
 * Scan books not yet evaluated by inspecting page text body.
 */
export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 50 } = {}) {
  ensureSearchPolicySchema(stateDb);
  const schemas = hasTambahan ? ['main', 'tambahan'] : ['main'];
  const now = Date.now();

  const evaluated = new Set(stateDb.prepare('SELECT bkid FROM search_book_policy').all().map(r => r.bkid));
  const candidates = [];

  for (const schema of schemas) {
    try {
      const rows = db.prepare(`SELECT bkid, bk FROM ${schema}.books_meta`).all();
      for (const r of rows) {
        if (!evaluated.has(r.bkid)) {
          candidates.push({ bkid: r.bkid, bk: r.bk, schema });
          if (candidates.length >= limit) break;
        }
      }
    } catch {}
    if (candidates.length >= limit) break;
  }

  if (!candidates.length) return 0;

  const ins = stateDb.prepare(POLICY_UPSERT);

  stateDb.transaction(() => {
    for (const c of candidates) {
      if (c.bk && containsExcludedAiName(c.bk)) {
        ins.run(c.bkid, 1, 'title', now, AI_BOOK_POLICY_VERSION);
        continue;
      }
      let isExcluded = false;
      try {
        for (const p of db.prepare(`SELECT nass FROM ${c.schema}.pages WHERE book_id = ?`).iterate(c.bkid)) {
          if (containsExcludedAiName(policyBody(p.nass))) {
            isExcluded = true;
            break;
          }
        }
      } catch {}
      ins.run(c.bkid, isExcluded ? 1 : 0, isExcluded ? 'content' : null, now, AI_BOOK_POLICY_VERSION);
    }
  })();

  cachedExcludedIds = null;
  return candidates.length;
}

export const SEARCH_POLICY_FTS_TERMS = ['"ابن باز"', '"ابن عثيمين"', '"عثيمين"', '"الألباني"', '"شيخ الإسلام ابن تيمية"', '"شيخ الاسلام ابن تيمية"'];

/**
 * Rapidly discover books containing excluded names in content via FTS index.
 */
export function scanFtsCandidateBooks(db, stateDb, { hasTambahan = false, limitPerTerm = 200 } = {}) {
  ensureSearchPolicySchema(stateDb);
  const schemas = (hasTambahan ? ['main', 'tambahan'] : ['main'])
    .filter(schema => db.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE name='pages_fts' AND type='table'`).get());
  const evaluated = new Set(stateDb.prepare('SELECT bkid FROM search_book_policy').all().map(r => r.bkid));
  const candidateIds = new Set();

  for (const schema of schemas) {
    const fts = schema === 'main' ? 'pages_fts' : `${schema}.pages_fts`;
    const pages = schema === 'main' ? 'pages' : `${schema}.pages`;
    for (const term of SEARCH_POLICY_FTS_TERMS) {
      try {
        const rows = db.prepare(`SELECT DISTINCT p.book_id FROM ${fts} f JOIN ${pages} p ON p.rowid = f.rowid WHERE ${fts} MATCH ? LIMIT ?`).all(term, limitPerTerm);
        for (const r of rows) {
          if (!evaluated.has(r.book_id)) candidateIds.add(r.book_id);
        }
      } catch {}
    }
  }

  if (!candidateIds.size) return 0;

  const now = Date.now();
  const ins = stateDb.prepare(POLICY_UPSERT);

  stateDb.transaction(() => {
    for (const bookId of candidateIds) {
      let isExcluded = false;
      for (const schema of schemas) {
        const pages = schema === 'main' ? 'pages' : `${schema}.pages`;
        try {
          for (const p of db.prepare(`SELECT nass FROM ${pages} WHERE book_id = ?`).iterate(bookId)) {
            if (containsExcludedAiName(policyBody(p.nass))) {
              isExcluded = true;
              break;
            }
          }
        } catch {}
        if (isExcluded) break;
      }
      ins.run(bookId, isExcluded ? 1 : 0, isExcluded ? 'content' : null, now, AI_BOOK_POLICY_VERSION);
    }
  })();

  cachedExcludedIds = null;
  return candidateIds.size;
}
