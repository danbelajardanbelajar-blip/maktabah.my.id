function likePatternToRegExp(pattern) {
  const escaped = String(pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.');
  return new RegExp(escaped, 'i');
}

export function loadPopularQueries(stateDb, limit = 2000) {
  if (!stateDb) return [];
  try {
    return stateDb.prepare(`
      SELECT trim(query) AS text, COUNT(*) AS count, MAX(id) AS max_id
      FROM search_logs
      WHERE length(trim(query)) BETWEEN 2 AND 60
        AND result_count > 0
      GROUP BY LOWER(trim(query))
      ORDER BY CASE WHEN COUNT(*) >= 3 THEN 0 ELSE 1 END, count DESC, max_id DESC
      LIMIT ?
    `).all(limit).map((r) => ({
      text: String(r.text || '').trim(),
      lower: String(r.text || '').trim().toLowerCase(),
      count: Number(r.count) || 0,
    })).filter((r) => r.text.length >= 2);
  } catch {
    return [];
  }
}

export function filterPopularQueries({
  popularRows,
  query,
  likeQuery,
  books = [],
  queryLimit = 4,
}) {
  const qLower = query.toLowerCase();
  const likeRegex = likePatternToRegExp(likeQuery);
  const matches = [];
  const seenQueries = new Set();
  const bookTitles = new Set(books.map((b) => b.title.trim().toLowerCase()));

  for (const row of popularRows) {
    if (!row.text || seenQueries.has(row.lower) || bookTitles.has(row.lower)) continue;
    const isMatch = row.lower.includes(qLower) || likeRegex.test(row.text);
    if (!isMatch) continue;
    seenQueries.add(row.lower);
    matches.push({
      text: row.text,
      count: row.count,
      isPopular: row.count >= 3,
      isPrefix: row.lower.startsWith(qLower),
    });
  }

  matches.sort((a, b) => {
    if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
    if (a.isPrefix !== b.isPrefix) return a.isPrefix ? -1 : 1;
    if (b.count !== a.count) return b.count - a.count;
    return 0;
  });

  return matches.slice(0, queryLimit).map(({ text, count }) => ({ text, count }));
}

export function queryAutocomplete({
  db,
  stateDb,
  hasAdditional = () => false,
  likeMatch = (s) => s,
  getExcludedBookIds = () => new Set(),
  popularRows = null,
  query = '',
  bookLimit = 4,
  queryLimit = 4,
}) {
  const q = String(query || '').trim();
  if (q.length < 2 || q.length > 100) {
    return { books: [], queries: [] };
  }

  const likeQuery = likeMatch(q);
  if (!likeQuery || !likeQuery.trim()) {
    return { books: [], queries: [] };
  }

  const containsPattern = `%${likeQuery}%`;
  const prefixPattern = `${likeQuery}%`;
  const books = [];
  const seenBooks = new Set();
  const excluded = getExcludedBookIds ? getExcludedBookIds(stateDb) : new Set();

  if (db) {
    const schemas = hasAdditional() ? ['main', 'tambahan'] : ['main'];
    for (const schema of schemas) {
      if (books.length >= bookLimit) break;
      try {
        const rows = db.prepare(`
          SELECT b.bkid, b.bk, c.name AS cat_name
          FROM ${schema}.books_meta b
          LEFT JOIN ${schema}.categories c ON b.cat = c.id
          WHERE b.bk LIKE ?
          ORDER BY CASE WHEN b.bk LIKE ? THEN 0 ELSE 1 END, LENGTH(b.bk) ASC
          LIMIT ?
        `).all(containsPattern, prefixPattern, (bookLimit - books.length) + excluded.size + 4);

        for (const r of rows) {
          if (excluded.has(r.bkid) || seenBooks.has(r.bkid)) continue;
          seenBooks.add(r.bkid);
          books.push({
            bkid: r.bkid,
            title: r.bk,
            category: r.cat_name || '',
          });
          if (books.length >= bookLimit) break;
        }
      } catch {
        // Ignore if schema or table doesn't exist
      }
    }
  }

  let queries = [];
  if (Array.isArray(popularRows)) {
    queries = filterPopularQueries({
      popularRows,
      query: q,
      likeQuery,
      books,
      queryLimit,
    });
  } else if (stateDb) {
    try {
      const qLower = q.toLowerCase();
      const qContains = `%${qLower.replace(/[\\%_]/g, '\\$&')}%`;
      const qPrefix = `${qLower.replace(/[\\%_]/g, '\\$&')}%`;
      const rows = stateDb.prepare(`
        SELECT trim(query) AS query, COUNT(*) AS cnt
        FROM search_logs
        WHERE length(trim(query)) BETWEEN 2 AND 60
          AND result_count > 0
          AND (LOWER(query) LIKE ? ESCAPE '\\' OR query LIKE ?)
        GROUP BY LOWER(trim(query))
        ORDER BY CASE WHEN COUNT(*) >= 3 THEN 0 ELSE 1 END,
                 CASE WHEN LOWER(trim(query)) LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
                 cnt DESC,
                 MAX(id) DESC
        LIMIT ?
      `).all(qContains, containsPattern, qPrefix, queryLimit * 2);

      const seenQueries = new Set();
      for (const r of rows) {
        const text = String(r.query || '').trim();
        const key = text.toLowerCase();
        if (!text || seenQueries.has(key)) continue;
        if (books.some((b) => b.title.trim().toLowerCase() === key)) continue;
        seenQueries.add(key);
        queries.push({ text, count: r.cnt });
        if (queries.length >= queryLimit) break;
      }
    } catch {
      // Ignore if search_logs isn't ready
    }
  }

  return { books, queries };
}

export function registerSearchAutocomplete(app, {
  getDb,
  getStateDb,
  hasAdditional,
  likeMatch,
  getExcludedBookIds,
  isMaintenance = () => false,
  now = Date.now,
}) {
  const cache = new Map();
  let cachedDb = null;
  let popularCache = { at: 0, stateDb: null, rows: null };
  const ttlMs = 2 * 60 * 1000;

  app.get('/api/autocomplete', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2 || q.length > 100) {
      return res.json({ books: [], queries: [] });
    }

    const db = getDb();
    const stateDb = getStateDb ? getStateDb() : null;
    if (!db || isMaintenance()) {
      return res.json({ books: [], queries: [] });
    }

    if (cachedDb !== db) {
      cache.clear();
      cachedDb = db;
    }

    const currentTime = now();
    const key = q.toLowerCase();
    const cached = cache.get(key);
    if (cached && currentTime - cached.at < ttlMs) {
      return res.json(cached.data);
    }

    if (stateDb && (popularCache.stateDb !== stateDb || !popularCache.rows || currentTime - popularCache.at >= ttlMs)) {
      popularCache = {
        at: currentTime,
        stateDb,
        rows: loadPopularQueries(stateDb),
      };
    }

    const data = queryAutocomplete({
      db,
      stateDb,
      hasAdditional,
      likeMatch,
      getExcludedBookIds,
      popularRows: stateDb ? popularCache.rows : null,
      query: q,
    });

    if (cache.size >= 500) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, { at: currentTime, data });
    return res.json(data);
  });
}
