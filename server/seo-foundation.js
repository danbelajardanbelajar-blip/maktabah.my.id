import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SITE_URL = 'https://maktab.my.id';

/**
 * Normalize the canonical base URL without a trailing slash.
 * @param {string | undefined} raw
 * @returns {string}
 */
export function normalizeSiteUrl(raw) {
  const value = String(raw || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  return value || DEFAULT_SITE_URL;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build robots.txt content for public crawling while blocking admin/private paths.
 * @param {string} siteUrl
 * @returns {string}
 */
export function buildRobotsTxt(siteUrl = DEFAULT_SITE_URL) {
  const base = normalizeSiteUrl(siteUrl);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /pengaturan',
    'Disallow: /koleksi',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * Build a valid XML sitemap for curated public canonical URLs.
 * @param {string} siteUrl
 * @param {Array<{loc: string, changefreq?: string, priority?: string, lastmod?: string}>} [entries]
 * @returns {string}
 */
export function buildSitemapXml(siteUrl = DEFAULT_SITE_URL, entries) {
  const base = normalizeSiteUrl(siteUrl);
  const items = entries || [
    { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${base}/privacy-policy`, changefreq: 'monthly', priority: '0.3' },
  ];
  const body = items
    .map((item) => {
      const parts = [`    <loc>${escapeXml(item.loc)}</loc>`];
      if (item.lastmod) parts.push(`    <lastmod>${escapeXml(item.lastmod)}</lastmod>`);
      if (item.changefreq) parts.push(`    <changefreq>${escapeXml(item.changefreq)}</changefreq>`);
      if (item.priority) parts.push(`    <priority>${escapeXml(item.priority)}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Render a clean, non-indexed 404 page so unknown URLs never return soft-404 200 OK.
 * @param {string} requestPath
 * @returns {string}
 */
export function buildNotFoundHtml(requestPath = '') {
  const safePath = escapeHtml(requestPath);
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Halaman Tidak Ditemukan (404) — al Maktabah as Sunniyyah</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;color:#1e293b;font:16px/1.6 system-ui,-apple-system,sans-serif}
      main{max-width:540px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(15,23,42,.06);text-align:center}
      .ar{font-size:22px;color:#065f46;margin:0 0 8px}
      h1{font-size:24px;margin:0 0 12px;color:#0f172a}
      p{margin:0 0 20px;color:#475569}
      code{background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:14px;word-break:break-all}
      .actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
      a{display:inline-block;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px}
      .primary{background:#047857;color:#fff}
      .secondary{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
    </style>
  </head>
  <body>
    <main>
      <p class="ar" lang="ar" dir="rtl">المكتبة السنية</p>
      <h1>Halaman Tidak Ditemukan (404)</h1>
      <p>Alamat <code>${safePath || '/'}</code> tidak tersedia di al Maktabah as Sunniyyah.</p>
      <div class="actions">
        <a class="primary" href="/">Kembali ke Beranda</a>
        <a class="secondary" href="/#/katalog">Buka Katalog Kitab</a>
      </div>
    </main>
  </body>
</html>
`;
}

function redirectWithQuery(req, res, targetPath) {
  const queryIndex = req.originalUrl.indexOf('?');
  const suffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  return res.redirect(301, `${targetPath}${suffix}`);
}

/**
 * Register Stage-1 SEO HTTP foundation routes, canonical redirects, static serving, and strict 404 fallback.
 * @param {import('express').Express} app
 * @param {{ express: typeof import('express'), distPath: string, siteUrl?: string, staticCacheControl: (filename: string) => string }} options
 */
export function registerSeoFoundation(app, { express, distPath, siteUrl, staticCacheControl }) {
  const canonicalBase = normalizeSiteUrl(siteUrl || process.env.SITE_URL);
  const robotsTxt = buildRobotsTxt(canonicalBase);
  const sitemapXml = buildSitemapXml(canonicalBase);

  app.get('/robots.txt', (_req, res) => {
    res.status(200)
      .set('Cache-Control', 'public, max-age=3600')
      .type('text/plain; charset=utf-8')
      .send(robotsTxt);
  });

  app.get('/sitemap.xml', (_req, res) => {
    res.status(200)
      .set('Cache-Control', 'public, max-age=3600')
      .type('application/xml; charset=utf-8')
      .send(sitemapXml);
  });

  app.get(['/index.dev.html', '/index.html'], (req, res) => {
    return redirectWithQuery(req, res, '/');
  });

  app.get('/privacy-policy.html', (req, res) => {
    return redirectWithQuery(req, res, '/privacy-policy');
  });

  app.get('/privacy-policy', (req, res, next) => {
    if (req.path === '/privacy-policy/') {
      return redirectWithQuery(req, res, '/privacy-policy');
    }
    const privacyFile = path.join(distPath, 'privacy-policy', 'index.html');
    if (fs.existsSync(privacyFile)) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(privacyFile);
    }
    return next();
  });

  if (fs.existsSync(distPath)) {
    app.get('/', (_req, res, next) => {
      const homeFile = path.join(distPath, 'index.dev.html');
      if (!fs.existsSync(homeFile)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(homeFile);
    });

    app.use(express.static(distPath, {
      index: false,
      redirect: false,
      setHeaders: (res, filename) => res.setHeader('Cache-Control', staticCacheControl(filename)),
    }));
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
    }
    if (req.path.startsWith('/assets/') || Boolean(path.extname(req.path))) {
      return res.status(404).set('Cache-Control', 'no-cache').type('text/plain; charset=utf-8').send('Not Found');
    }
    return res.status(404)
      .set('Cache-Control', 'no-cache')
      .type('text/html; charset=utf-8')
      .send(buildNotFoundHtml(req.path));
  });
}
