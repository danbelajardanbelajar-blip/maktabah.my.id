import { createManualBook, createManualPage } from './manual-book.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const ALLOWED_HOSTS = new Set(['islam.nu.or.id', 'nu.or.id', 'www.nu.or.id']);

export function validateNuOnlineUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw fail('URL NU Online tidak valid.');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw fail('Hanya URL resmi nu.or.id (HTTPS) yang diizinkan.');
  }
  return parsed.toString().split('#')[0];
}

export function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rdquo;/gi, '”')
    .replace(/&ldquo;/gi, '“')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function stripTags(html) {
  return decodeHtmlEntities(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function normalizeKeywordMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/ba[ht]*sul\s*mas[a']*[iy]l/g, 'bahtsul masail')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNuOnlineListHtml(html) {
  const seen = new Set();
  const posts = [];

  // Match links to /bahtsul-masail/<slug> with either surrounding anchor text or image alt
  const anchorRegex = /<a[^>]+href="(https:\/\/islam\.nu\.or\.id\/bahtsul-masail\/[^"?#]+|\/bahtsul-masail\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html || '').matchAll(anchorRegex)) {
    const rawHref = match[1];
    if (rawHref === '/bahtsul-masail' || rawHref === 'https://islam.nu.or.id/bahtsul-masail') continue;
    const url = rawHref.startsWith('http') ? rawHref : `https://islam.nu.or.id${rawHref}`;
    if (seen.has(url)) continue;

    const inner = match[2] || '';
    const altMatch = inner.match(/\balt="([^"]{8,300})"/i);
    const headingMatch = inner.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    const title = stripTags(headingMatch?.[1] || altMatch?.[1] || inner);
    if (!title || title.length < 8) continue;

    seen.add(url);
    const slug = url.split('/bahtsul-masail/')[1] || '';
    posts.push({ url, slug, title });
  }

  return posts;
}

export function parseNuOnlineArticleHtml(html, url = '') {
  const raw = String(html || '');
  const jsonLds = [];
  for (const m of raw.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed && typeof parsed === 'object') jsonLds.push(parsed);
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }
  const newsLd = jsonLds.find((j) => j['@type'] === 'NewsArticle') || jsonLds.find((j) => j.headline) || {};
  const h1Match = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = stripTags(newsLd.headline || h1Match?.[1] || '');
  const publishedAt = typeof newsLd.datePublished === 'string' ? newsLd.datePublished : '';
  const description = stripTags(newsLd.description || '');

  // Author: check JSON-LD author or NU Online byline pattern
  let author = '';
  if (newsLd.author) {
    if (typeof newsLd.author === 'string') author = stripTags(newsLd.author);
    else if (Array.isArray(newsLd.author)) author = stripTags(newsLd.author[0]?.name || '');
    else if (newsLd.author.name) author = stripTags(newsLd.author.name);
  }
  if (!author) {
    const byline = raw.match(/<p[^>]*class="[^"]*font-bold[^"]*"[^>]*>([\s\S]*?)<\/p>[\s\S]{0,180}?(?:Kolumnis|Penulis|Redaktur|Kontributor)/i);
    if (byline) author = stripTags(byline[1]);
  }

  // Extract body from #detail-content if present
  let bodyHtml = '';
  const detailStart = raw.search(/<div[^>]+id="detail-content"[^>]*>/i);
  if (detailStart >= 0) {
    const slice = raw.slice(detailStart);
    // Stop before Tags section, share/tags/related, or footer
    const endMarker = slice.search(/<(?:nav\b[^>]*>[\s\S]{0,160}>\s*Tags\s*<|div[^>]+id="(?:share|tags|related)|footer\b)/i);
    bodyHtml = endMarker > 0 ? slice.slice(0, endMarker) : slice.slice(0, 120000);
  } else {
    bodyHtml = raw;
  }

  // Strip scripts, styles, SVGs, and inline "Baca Juga" recommendation blocks
  bodyHtml = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<div[^>]*>\s*<div[^>]*>\s*<p[^>]*>\s*Baca Juga\s*<\/p>[\s\S]*?<\/div>\s*<\/div>\s*<a[\s\S]*?<\/a>/gi, ' ');

  const paragraphs = [];
  const blockRegex = /<(p|h2|h3|h4|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of bodyHtml.matchAll(blockRegex)) {
    const text = stripTags(m[2]);
    if (!text) continue;
    if (/^(?:Tags|Tag|Terpopuler|Artikel Terkait|Berita Terkait|Download Aplikasi NU Online)$/i.test(text)) break;
    if (/^(Baca Juga|Lihat Semua|Kolumnis|Editor|Penulis|Bagikan:?)$/i.test(text)) continue;
    if (paragraphs.length && paragraphs[paragraphs.length - 1] === text) continue;
    paragraphs.push(text);
  }

  const fullText = paragraphs.join('\n\n');
  const norm = normalizeKeywordMatch(`${title} ${url} ${fullText}`);
  const containsBahtsulMasail = norm.includes('bahtsul masail');

  return {
    url,
    title,
    author,
    publishedAt,
    description,
    paragraphs,
    fullText,
    containsBahtsulMasail,
  };
}

export function splitArticleIntoPages(text, maxChars = 3000) {
  const clean = String(text || '').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const pages = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > maxChars) {
      pages.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages;
}

export function ensureNuOnlineSchema(stateDb) {
  if (!stateDb) return;
  stateDb.exec(`
    CREATE TABLE IF NOT EXISTS nu_online_index (
      url TEXT PRIMARY KEY,
      slug TEXT,
      title TEXT NOT NULL,
      author TEXT,
      published_at TEXT,
      excerpt TEXT,
      has_bahtsul_masail INTEGER DEFAULT 1,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      imported_bkid INTEGER
    );
    CREATE INDEX IF NOT EXISTS nu_online_index_imported ON nu_online_index(imported_bkid);
  `);
}

export async function indexNuOnlinePages({
  stateDb,
  startPage = 1,
  pageCount = 2,
  keyword = 'bahtsul masail',
  fetchImpl = fetch,
}) {
  ensureNuOnlineSchema(stateDb);
  const start = Math.max(1, Math.min(200, Number(startPage) || 1));
  const count = Math.max(1, Math.min(5, Number(pageCount) || 2));
  const normKw = normalizeKeywordMatch(keyword);

  let foundTotal = 0;
  let newCount = 0;
  const indexedPosts = [];

  const upsert = stateDb.prepare(`
    INSERT INTO nu_online_index (url, slug, title, has_bahtsul_masail, indexed_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      indexed_at = CURRENT_TIMESTAMP
  `);

  for (let p = start; p < start + count; p++) {
    const listUrl = `https://islam.nu.or.id/bahtsul-masail?page=${p}`;
    const res = await fetchImpl(listUrl, {
      headers: { 'User-Agent': 'MaktabahIndexer/1.0 (+https://maktab.my.id)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw fail(`Gagal mengambil halaman ${p} NU Online (HTTP ${res.status}).`, 502);
    const html = await res.text();
    const posts = parseNuOnlineListHtml(html);
    for (const post of posts) {
      foundTotal++;
      const matchesKeyword = !normKw || normalizeKeywordMatch(`${post.title} ${post.url}`).includes(normKw);
      if (!matchesKeyword) continue;

      const existing = stateDb.prepare('SELECT url, imported_bkid FROM nu_online_index WHERE url = ?').get(post.url);
      if (!existing) newCount++;
      upsert.run(post.url, post.slug, post.title, 1);
      indexedPosts.push({ ...post, imported_bkid: existing?.imported_bkid ?? null });
    }
  }

  return { startPage: start, pageCount: count, foundTotal, matched: indexedPosts.length, newCount, posts: indexedPosts };
}

export async function previewNuOnlineArticle({ stateDb, url, fetchImpl = fetch }) {
  const safeUrl = validateNuOnlineUrl(url);
  const res = await fetchImpl(safeUrl, {
    headers: { 'User-Agent': 'MaktabahIndexer/1.0 (+https://maktab.my.id)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw fail(`Gagal membuka artikel NU Online (HTTP ${res.status}).`, 502);
  const html = await res.text();
  const article = parseNuOnlineArticleHtml(html, safeUrl);
  if (!article.title || !article.fullText) {
    throw fail('Isi artikel NU Online tidak dapat diekstrak.', 422);
  }

  if (stateDb) {
    ensureNuOnlineSchema(stateDb);
    stateDb.prepare(`
      INSERT INTO nu_online_index (url, slug, title, author, published_at, excerpt, has_bahtsul_masail, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(url) DO UPDATE SET
        title = COALESCE(NULLIF(excluded.title, ''), nu_online_index.title),
        author = excluded.author,
        published_at = excluded.published_at,
        excerpt = excluded.excerpt,
        has_bahtsul_masail = excluded.has_bahtsul_masail,
        indexed_at = CURRENT_TIMESTAMP
    `).run(
      safeUrl,
      safeUrl.split('/bahtsul-masail/')[1] || '',
      article.title,
      article.author || null,
      article.publishedAt || null,
      article.fullText.slice(0, 280),
      article.containsBahtsulMasail ? 1 : 0
    );
  }

  const row = stateDb?.prepare('SELECT imported_bkid FROM nu_online_index WHERE url = ?').get(safeUrl);
  return { ...article, imported_bkid: row?.imported_bkid ?? null };
}

export function importNuOnlineArticle(db, stateDb, { url, title, author, catId, content, publishedAt }, { hasAdditional = false } = {}) {
  const safeUrl = validateNuOnlineUrl(url);
  const pages = splitArticleIntoPages(content);
  if (!pages.length) throw fail('Isi artikel kosong, tidak dapat di-import.');

  const infoParts = [`Sumber: NU Online (${safeUrl})`];
  if (publishedAt) infoParts.push(`Tanggal: ${publishedAt.slice(0, 10)}`);

  const created = createManualBook(db, {
    title,
    catId,
    author,
    inf: infoParts.join(' | '),
    initialPart: 1,
    initialPage: 1,
    initialNass: pages[0],
  }, { hasAdditional });

  for (let i = 1; i < pages.length; i++) {
    createManualPage(db, created.bkid, { part: 1, page: i + 1, nass: pages[i] });
  }

  if (stateDb) {
    ensureNuOnlineSchema(stateDb);
    stateDb.prepare(`
      INSERT INTO nu_online_index (url, slug, title, author, published_at, excerpt, has_bahtsul_masail, imported_bkid)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(url) DO UPDATE SET imported_bkid = excluded.imported_bkid
    `).run(safeUrl, safeUrl.split('/bahtsul-masail/')[1] || '', title, author || null, publishedAt || null, pages[0].slice(0, 280), created.bkid);
  }

  return { ...created, pagesCount: pages.length, url: safeUrl };
}

export function registerNuOnline(app, { getDb, getStateDb, requireAdmin, hasAdditional, invalidateCache, onBookCreated, fetchImpl = fetch }) {
  app.get('/api/admin/nu-online/posts', requireAdmin, (req, res) => {
    const stateDb = getStateDb();
    if (!stateDb) return res.status(503).json({ error: 'Database state belum tersedia.' });
    try {
      ensureNuOnlineSchema(stateDb);
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || 'all');
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(5, parseInt(String(req.query.limit || '20'), 10) || 20));
      const offset = (page - 1) * limit;

      const conds = [];
      const params = [];
      if (q) {
        conds.push('(title LIKE ? OR excerpt LIKE ? OR url LIKE ? OR author LIKE ?)');
        const pat = `%${q}%`;
        params.push(pat, pat, pat, pat);
      }
      if (status === 'imported') conds.push('imported_bkid IS NOT NULL');
      else if (status === 'unimported') conds.push('imported_bkid IS NULL');

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const total = stateDb.prepare(`SELECT COUNT(*) AS c FROM nu_online_index ${where}`).get(...params).c;
      const stats = stateDb.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(imported_bkid IS NOT NULL), 0) AS imported FROM nu_online_index`).get();
      const data = stateDb.prepare(`SELECT * FROM nu_online_index ${where} ORDER BY indexed_at DESC, rowid DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      res.json({ data, total, page, limit, stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/nu-online/index', requireAdmin, async (req, res) => {
    const stateDb = getStateDb();
    if (!stateDb) return res.status(503).json({ error: 'Database state belum tersedia.' });
    try {
      const result = await indexNuOnlinePages({
        stateDb,
        startPage: req.body?.startPage,
        pageCount: req.body?.pageCount,
        keyword: req.body?.keyword ?? 'bahtsul masail',
        fetchImpl,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get('/api/admin/nu-online/preview', requireAdmin, async (req, res) => {
    try {
      const article = await previewNuOnlineArticle({
        stateDb: getStateDb(),
        url: req.query.url,
        fetchImpl,
      });
      res.json({ success: true, article });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/admin/nu-online/import', requireAdmin, (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
    try {
      const book = importNuOnlineArticle(db, getStateDb(), req.body || {}, { hasAdditional: hasAdditional() });
      try { onBookCreated?.({ bookId: book.bkid, title: book.bk, authorName: req.body?.author, sourceRef: 'Import NU Online' }); } catch { /* Non-fatal */ }
      invalidateCache?.();
      res.status(201).json({ success: true, book });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });
}
