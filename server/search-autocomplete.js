export function queryAutocomplete({
  db,
  stateDb,
  hasAdditional = () => false,
  likeMatch = (s) => s,
  getExcludedBookIds = () => new Set(),
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

  const queries = [];
  const seenQueries = new Set();
  if (stateDb) {
    try {
      const qLower = q.toLowerCase();
      const qContains = `%${qLower.replace(/[\\%_]/g, '\\$&')}%`;
      const qPrefix = `${qLower.replace(/[\\%_]/g, '\\$&')}%`;
      const rows = stateDb.prepare(`
        SELECT query, COUNT(*) AS cnt
        FROM search_logs
        WHERE length(trim(query)) >= 2
          AND (result_count IS NULL OR result_count > 0)
          AND (LOWER(query) LIKE ? ESCAPE '\\' OR query LIKE ?)
        GROUP BY LOWER(trim(query))
        ORDER BY CASE WHEN LOWER(trim(query)) LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, cnt DESC, MAX(id) DESC
        LIMIT ?
      `).all(qContains, containsPattern, qPrefix, queryLimit * 2);

      for (const r of rows) {
        const text = String(r.query || '').trim();
        const key = text.toLowerCase();
        if (!text || seenQueries.has(key)) continue;
        // Skip if identical to a book title already in the book list
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

    const key = q.toLowerCase();
    const cached = cache.get(key);
    if (cached && now() - cached.at < ttlMs) {
      return res.json(cached.data);
    }

    const data = queryAutocomplete({
      db,
      stateDb,
      hasAdditional,
      likeMatch,
      getExcludedBookIds,
      query: q,
    });

    if (cache.size >= 500) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, { at: now(), data });
    return res.json(data);
  });
}
