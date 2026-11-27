import { DEFAULT_SITE_URL, normalizeSiteUrl } from './seo-foundation.js';

const ARABIC_DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const ARABIC_SLUG_MAP = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ء': '', 'ؤ': 'u', 'ئ': 'i',
  'ب': 'b', 'ت': 't', 'ث': 'ts', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dz', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sy',
  'ص': 'sh', 'ض': 'dh', 'ط': 'th', 'ظ': 'zh', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * Convert an Arabic or Latin book title into a clean ASCII URL slug.
 * @param {string} title
 * @returns {string}
 */
export function slugifyTitle(title) {
  const stripped = String(title || '')
    .normalize('NFKD')
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/[\u0300-\u036f]/g, '');

  let out = '';
  for (const ch of stripped) {
    if (ARABIC_SLUG_MAP[ch] !== undefined) {
      out += ARABIC_SLUG_MAP[ch];
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
    } else {
      out += '-';
    }
  }

  const slug = out
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');

  return slug || 'kitab';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, maxLen = 0) {
  const text = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!maxLen || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Create a side-effect-free, cacheable service for reading public book SEO metadata.
 */
export function createBookSeoService({
  getDb,
  booksMeta,
  authorsUnion,
  pagesUnion,
  titlesUnion,
  getAuthorProfiles,
  isMaintenance,
  maxCacheEntries = 500,
}) {
  const cache = new Map();

  function invalidate() {
    cache.clear();
  }

  function getBookDetail(rawId) {
    const bookId = Number(rawId);
    if (!Number.isSafeInteger(bookId) || bookId <= 0) return null;

    if (isMaintenance?.()) {
      const err = new Error('Perpustakaan sedang dalam pemeliharaan atau transfer data.');
      err.status = 503;
      throw err;
    }

    const db = getDb();
    if (!db) {
      const err = new Error('Database perpustakaan sementara tidak tersedia.');
      err.status = 503;
      throw err;
    }

    if (cache.has(bookId)) {
      return cache.get(bookId);
    }

    let row;
    try {
      row = db.prepare(`
        SELECT b.bkid, b.bk, b.cat, b.inf as book_inf, b.betaka,
               c.name as category, a.auth, a.HigriD, a.AD
        FROM ${booksMeta()} b
        LEFT JOIN main.categories c ON b.cat = c.id
        LEFT JOIN ${authorsUnion()} a ON b.authno = a.authid
        WHERE b.bkid = ?
        LIMIT 1
      `).get(bookId);
    } catch (error) {
      const err = new Error(error.message || 'Gagal membaca database kitab.');
      err.status = 503;
      throw err;
    }

    if (!row) return null;

    let totalPages = 0;
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as total_pages FROM ${pagesUnion()} p WHERE p.book_id = ?`).get(bookId);
      totalPages = countRow ? Number(countRow.total_pages) || 0 : 0;
    } catch {
      totalPages = 0;
    }

    let toc = [];
    let tocTotal = 0;
    try {
      toc = db.prepare(`SELECT id, lvl, sub, tit FROM ${titlesUnion()} t WHERE t.book_id = ? ORDER BY t.id ASC LIMIT 40`).all(bookId);
      const tocCountRow = db.prepare(`SELECT COUNT(*) as total FROM ${titlesUnion()} t WHERE t.book_id = ?`).get(bookId);
      tocTotal = tocCountRow ? Number(tocCountRow.total) || toc.length : toc.length;
    } catch {
      toc = [];
      tocTotal = 0;
    }

    let authorProfiles = [];
    try {
      authorProfiles = getAuthorProfiles ? (getAuthorProfiles(bookId, row.bk) || []) : [];
    } catch {
      authorProfiles = [];
    }

    const slug = slugifyTitle(row.bk);
    const detail = {
      bkid: row.bkid,
      title: cleanText(row.bk) || `Kitab #${row.bkid}`,
      category: cleanText(row.category),
      categoryId: row.cat ?? null,
      author: cleanText(row.auth),
      authorDeathHijri: row.HigriD || null,
      authorDeathAd: row.AD || null,
      authorProfiles,
      summary: cleanText(row.betaka || row.book_inf, 1200),
      totalPages,
      toc: toc.map((item) => ({
        id: item.id,
        lvl: Number(item.lvl) || 1,
        title: cleanText(item.tit, 180),
      })).filter((item) => item.title),
      tocTotal,
      slug,
      canonicalPath: `/kitab/${row.bkid}-${slug}`,
    };

    if (cache.size >= maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(bookId, detail);
    return detail;
  }

  return { getBookDetail, invalidate };
}

/**
 * Render standalone, crawler-friendly HTML for a public book detail page.
 */
export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const base = normalizeSiteUrl(siteUrl);
  const canonicalUrl = `${base}${book.canonicalPath}`;
  const authorLabel = book.author || (book.authorProfiles?.[0]?.name ? cleanText(book.authorProfiles[0].name) : '');
  const descriptionParts = [
    `Baca kitab ${book.title}`,
    authorLabel ? `karya ${authorLabel}` : '',
    book.category ? `kategori ${book.category}` : '',
    book.totalPages ? `(${book.totalPages.toLocaleString('id-ID')} halaman)` : '',
    'secara gratis di al Maktabah as Sunniyyah.',
  ].filter(Boolean);
  const description = cleanText(descriptionParts.join(' '), 160);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Book',
        name: book.title,
        url: canonicalUrl,
        inLanguage: 'ar',
        ...(authorLabel ? { author: { '@type': 'Person', name: authorLabel } } : {}),
        ...(book.category ? { genre: book.category } : {}),
        ...(book.totalPages > 0 ? { numberOfPages: book.totalPages } : {}),
        isPartOf: {
          '@type': 'WebSite',
          name: 'al Maktabah as Sunniyyah',
          url: `${base}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Katalog Kitab', item: `${base}/#/katalog` },
          { '@type': 'ListItem', position: 3, name: book.title, item: canonicalUrl },
        ],
      },
    ],
  };

  const tocHtml = book.toc.length
    ? `<section class="card" aria-labelledby="toc-heading">
        <h2 id="toc-heading">Daftar Isi${book.tocTotal > book.toc.length ? ` (menampilkan ${book.toc.length} dari ${book.tocTotal} bab)` : ''}</h2>
        <ol class="toc-list">
          ${book.toc.map((item) => `<li class="toc-lvl-${Math.min(4, Math.max(1, item.lvl))}" dir="auto">${escapeHtml(item.title)}</li>`).join('\n          ')}
        </ol>
      </section>`
    : '';

  const summaryHtml = book.summary
    ? `<section class="card" aria-labelledby="info-heading">
        <h2 id="info-heading">Keterangan Kitab</h2>
        <p class="summary" dir="auto">${escapeHtml(book.summary)}</p>
      </section>`
    : '';

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(book.title)} — al Maktabah as Sunniyyah</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="book" />
    <meta property="og:site_name" content="al Maktabah as Sunniyyah" />
    <meta property="og:title" content="${escapeHtml(book.title)} — al Maktabah as Sunniyyah" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(`${base}/logo.png`)}" />
    <meta property="og:locale" content="id_ID" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(book.title)} — al Maktabah as Sunniyyah" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${base}/logo.png`)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#f4f7f5;color:#1e293b;font:16px/1.7 system-ui,-apple-system,sans-serif}
      header,main,footer{max-width:920px;margin:auto;padding:20px}
      header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .brand{font-weight:700;color:#065f46;text-decoration:none;font-size:15px}
      .nav-links{display:flex;gap:14px;font-size:14px}
      .nav-links a{color:#047857;text-decoration:none}
      .breadcrumb{font-size:13px;color:#64748b;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:6px}
      .breadcrumb a{color:#047857;text-decoration:none}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px;box-shadow:0 2px 10px rgba(15,23,42,.04)}
      h1{margin:0 0 14px;font-size:28px;line-height:1.45;color:#064e3b}
      h2{margin:0 0 12px;font-size:19px;color:#065f46}
      .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0 22px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
      .meta-item strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
      .meta-item span{font-weight:600;color:#0f172a}
      .actions{display:flex;gap:12px;flex-wrap:wrap}
      .btn-read{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:10px;background:#047857;color:#fff;font-weight:700;text-decoration:none}
      .btn-secondary{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-weight:600;text-decoration:none}
      .summary{margin:0;white-space:pre-line}
      .toc-list{margin:0;padding-inline-start:22px}
      .toc-list li{margin:6px 0}
      .toc-lvl-2{margin-inline-start:16px}
      .toc-lvl-3,.toc-lvl-4{margin-inline-start:32px;color:#475569}
      footer{font-size:13px;color:#64748b;text-align:center;padding-bottom:32px}
      footer a{color:#047857;text-decoration:none}
      @media(max-width:600px){.card{padding:18px}h1{font-size:23px}}
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">al Maktabah as Sunniyyah · <span lang="ar" dir="rtl">المكتبة السنية</span></a>
      <nav class="nav-links" aria-label="Navigasi">
        <a href="/#/katalog">Katalog</a>
        <a href="/#/kutub-hadis">Kutub Hadis</a>
        <a href="/#/penulis">Penulis</a>
      </nav>
    </header>
    <main>
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Beranda</a><span>/</span>
        <a href="/#/katalog">Katalog Kitab</a><span>/</span>
        <span dir="auto">${escapeHtml(book.title)}</span>
      </nav>
      <article class="card">
        <h1 dir="auto">${escapeHtml(book.title)}</h1>
        <div class="meta">
          <div class="meta-item"><strong>Penulis</strong><span dir="auto">${escapeHtml(authorLabel || 'Belum tercatat')}</span></div>
          <div class="meta-item"><strong>Kategori</strong><span dir="auto">${escapeHtml(book.category || 'Umum')}</span></div>
          <div class="meta-item"><strong>Jumlah Halaman</strong><span>${book.totalPages > 0 ? escapeHtml(book.totalPages.toLocaleString('id-ID')) : 'Belum tersedia'}</span></div>
          <div class="meta-item"><strong>ID Kitab</strong><span>#${escapeHtml(book.bkid)}</span></div>
        </div>
        <div class="actions">
          <a class="btn-read" href="/#/read/${escapeHtml(book.bkid)}">Baca Kitab</a>
          <a class="btn-secondary" href="/#/katalog">Jelajahi Katalog</a>
        </div>
      </article>
      ${summaryHtml}
      ${tocHtml}
    </main>
    <footer>
      <a href="/">maktab.my.id</a> · <a href="/privacy-policy">Kebijakan Privasi</a>
    </footer>
  </body>
</html>
`;
}

function renderUnavailableHtml(message) {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Layanan Sementara Sibuk (503) — al Maktabah as Sunniyyah</title>
  </head>
  <body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:20px;text-align:center">
    <h1>Layanan Sementara Tidak Tersedia (503)</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/">Kembali ke Beranda</a></p>
  </body>
</html>
`;
}

/**
 * Register public /kitab/:idSlug SEO routes with strict 301/404/503 semantics.
 */
export function registerBookSeoRoutes(app, { service, siteUrl } = {}) {
  const canonicalBase = normalizeSiteUrl(siteUrl || process.env.SITE_URL);

  app.get('/kitab/:idSlug', (req, res, next) => {
    const match = /^([1-9]\d*)(?:-(.*))?$/.exec(req.params.idSlug || '');
    if (!match) return next();

    const bookId = Number(match[1]);
    let book;
    try {
      book = service.getBookDetail(bookId);
    } catch (error) {
      return res.status(error.status || 503)
        .set('Retry-After', '60')
        .set('Cache-Control', 'no-store')
        .type('text/html; charset=utf-8')
        .send(renderUnavailableHtml(error.message));
    }

    if (!book) return next();

    const expectedParam = `${book.bkid}-${book.slug}`;
    if (req.params.idSlug !== expectedParam) {
      return res.redirect(301, book.canonicalPath);
    }

    return res.status(200)
      .set('Cache-Control', 'public, max-age=300')
      .type('text/html; charset=utf-8')
      .send(renderBookHtml(book, { siteUrl: canonicalBase }));
  });
}
