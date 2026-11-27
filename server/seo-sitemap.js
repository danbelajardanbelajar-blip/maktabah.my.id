import { hadithBooks } from './hadith-books.js';
import { buildSitemapXml } from './seo-foundation.js';
import { cleanText, DEFAULT_SITE_URL, normalizeSiteUrl, slugifyTitle } from './seo-utils.js';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a Sitemap Index XML document listing sub-sitemaps.
 * @param {string} siteUrl
 * @param {string[]} paths
 * @returns {string}
 */
export function buildSitemapIndexXml(siteUrl = DEFAULT_SITE_URL, paths = []) {
  const base = normalizeSiteUrl(siteUrl);
  const body = paths
    .map((p) => `  <sitemap>\n    <loc>${escapeXml(`${base}${p}`)}</loc>\n  </sitemap>`)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</sitemapindex>',
    '',
  ].join('\n');
}

/**
 * Register Stage-4 Sitemap Index and curated pilot sub-sitemaps (~75-90 URLs).
 */
export function registerSitemapRoutes(app, {
  getDb,
  booksMeta,
  getRowaDb,
  authorService,
  isMaintenance,
  siteUrl,
}) {
  const base = normalizeSiteUrl(siteUrl || process.env.SITE_URL);
  const cache = new Map();

  function assertReady(db) {
    if (isMaintenance?.()) {
      const err = new Error('Maintenance');
      err.status = 503;
      throw err;
    }
    if (!db) {
      const err = new Error('Database unavailable');
      err.status = 503;
      throw err;
    }
  }

  function sendXml(res, key, builder) {
    try {
      if (!cache.has(key)) {
        cache.set(key, builder());
      }
      return res.status(200)
        .set('Cache-Control', 'public, max-age=3600')
        .type('application/xml; charset=utf-8')
        .send(cache.get(key));
    } catch (error) {
      return res.status(error.status || 503)
        .set('Retry-After', '60')
        .set('Cache-Control', 'no-store')
        .type('text/plain; charset=utf-8')
        .send('Sitemap sementara tidak tersedia');
    }
  }

  app.get('/sitemap.xml', (_req, res) => {
    return sendXml(res, 'index', () =>
      buildSitemapIndexXml(base, [
        '/sitemap-static.xml',
        '/sitemap-books.xml',
        '/sitemap-authors.xml',
        '/sitemap-rowa.xml',
        '/sitemap-categories.xml',
      ])
    );
  });

  app.get('/sitemap-static.xml', (_req, res) => {
    return sendXml(res, 'static', () =>
      buildSitemapXml(base, [
        { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
        { loc: `${base}/katalog`, changefreq: 'daily', priority: '0.9' },
        { loc: `${base}/kutub-hadis`, changefreq: 'weekly', priority: '0.9' },
        { loc: `${base}/penulis`, changefreq: 'weekly', priority: '0.8' },
        { loc: `${base}/perawi`, changefreq: 'weekly', priority: '0.8' },
        { loc: `${base}/privacy-policy`, changefreq: 'monthly', priority: '0.3' },
      ])
    );
  });

  app.get('/sitemap-books.xml', (_req, res) => {
    return sendXml(res, 'books', () => {
      const db = getDb();
      assertReady(db);
      const selected = new Map();

      const allBooks = db.prepare(`SELECT bkid, bk FROM ${booksMeta()}`).all();
      const { books: hadithGroups } = hadithBooks(allBooks);
      for (const group of hadithGroups) {
        for (const ed of group.editions.slice(0, 2)) {
          if (!selected.has(ed.id)) {
            selected.set(ed.id, ed.title);
          }
          if (selected.size >= 15) break;
        }
        if (selected.size >= 15) break;
      }

      const remaining = 40 - selected.size;
      if (remaining > 0) {
        const richBooks = db.prepare(`
          SELECT bkid, bk FROM ${booksMeta()}
          WHERE length(trim(coalesce(betaka, inf, ''))) > 20
          ORDER BY bkid ASC
          LIMIT ?
        `).all(remaining + 20);
        for (const row of richBooks) {
          if (selected.size >= 40) break;
          if (!selected.has(row.bkid)) selected.set(row.bkid, row.bk);
        }
      }

      if (selected.size < 40) {
        for (const row of allBooks) {
          if (selected.size >= 40) break;
          if (!selected.has(row.bkid) && cleanText(row.bk)) {
            selected.set(row.bkid, row.bk);
          }
        }
      }

      const urls = [...selected.entries()].map(([id, title]) => ({
        loc: `${base}/kitab/${id}-${slugifyTitle(title)}`,
        changefreq: 'weekly',
        priority: '0.8',
      }));
      return buildSitemapXml(base, urls);
    });
  });

  app.get('/sitemap-authors.xml', (_req, res) => {
    return sendXml(res, 'authors', () => {
      assertReady(getDb());
      const resAuthors = authorService.authorList({ sort: 'name', limit: '50', page: '1' });
      const curated = (resAuthors.data || [])
        .filter((a) => a.workCount > 0 && a.hasBiography)
        .slice(0, 15);
      const list = curated.length >= 5 ? curated : (resAuthors.data || []).filter((a) => a.workCount > 0).slice(0, 15);
      const urls = list.map((a) => ({
        loc: `${base}/penulis/${a.id}-${slugifyTitle(a.name, 'penulis')}`,
        changefreq: 'monthly',
        priority: '0.7',
      }));
      return buildSitemapXml(base, urls);
    });
  });

  app.get('/sitemap-rowa.xml', (_req, res) => {
    return sendXml(res, 'rowa', () => {
      const rowaDb = getRowaDb();
      assertReady(rowaDb);
      const rows = rowaDb.prepare(`
        SELECT id, Name, A_esm, IsoName
        FROM rowa
        WHERE length(trim(coalesce(AQUAL, ''))) > 80
        ORDER BY id ASC
        LIMIT 15
      `).all();
      const fallback = rows.length
        ? rows
        : rowaDb.prepare('SELECT id, Name, A_esm, IsoName FROM rowa ORDER BY id ASC LIMIT 15').all();
      const urls = fallback.map((r) => {
        const name = cleanText(r.A_esm || r.Name || r.IsoName) || `Perawi ${r.id}`;
        return {
          loc: `${base}/perawi/${r.id}-${slugifyTitle(name, 'perawi')}`,
          changefreq: 'monthly',
          priority: '0.6',
        };
      });
      return buildSitemapXml(base, urls);
    });
  });

  app.get('/sitemap-categories.xml', (_req, res) => {
    return sendXml(res, 'categories', () => {
      const db = getDb();
      assertReady(db);
      const cats = db.prepare(`
        SELECT c.id, c.name, COUNT(b.bkid) as book_count
        FROM main.categories c
        JOIN ${booksMeta()} b ON b.cat = c.id
        GROUP BY c.id, c.name
        HAVING book_count > 0
        ORDER BY book_count DESC, c.id ASC
        LIMIT 8
      `).all();
      const urls = cats.map((c) => ({
        loc: `${base}/kategori/${c.id}-${slugifyTitle(c.name, 'kategori')}`,
        changefreq: 'weekly',
        priority: '0.7',
      }));
      return buildSitemapXml(base, urls);
    });
  });

  return { invalidate: () => cache.clear() };
}
