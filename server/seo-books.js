import {
  DEFAULT_SITE_URL,
  normalizeSiteUrl,
  slugifyTitle,
  escapeHtml,
  cleanText,
  renderUnavailableHtml,
  renderSeoPage,
} from './seo-utils.js';

export { slugifyTitle };

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
  const linkedAuthor = book.authorProfiles?.[0];
  const authorLabel = book.author || (linkedAuthor?.name ? cleanText(linkedAuthor.name) : '');
  const authorHref = linkedAuthor?.id ? `/penulis/${linkedAuthor.id}-${slugifyTitle(linkedAuthor.name, 'penulis')}` : '';
  const categoryHref = book.category && book.categoryId != null
    ? `/kategori/${book.categoryId}-${slugifyTitle(book.category, 'kategori')}`
    : '';

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
        ...(authorLabel ? { author: { '@type': 'Person', name: authorLabel, ...(authorHref ? { url: `${base}${authorHref}` } : {}) } } : {}),
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
          { '@type': 'ListItem', position: 2, name: 'Katalog Kitab', item: `${base}/katalog` },
          ...(categoryHref ? [{ '@type': 'ListItem', position: 3, name: book.category, item: `${base}${categoryHref}` }] : []),
          { '@type': 'ListItem', position: categoryHref ? 4 : 3, name: book.title, item: canonicalUrl },
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

  const authorCell = authorHref
    ? `<a href="${escapeHtml(authorHref)}" dir="auto">${escapeHtml(authorLabel)}</a>`
    : `<span dir="auto">${escapeHtml(authorLabel || 'Belum tercatat')}</span>`;

  const categoryCell = categoryHref
    ? `<a href="${escapeHtml(categoryHref)}" dir="auto">${escapeHtml(book.category)}</a>`
    : `<span dir="auto">${escapeHtml(book.category || 'Umum')}</span>`;

  const bodyHtml = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Beranda</a><span>/</span>
        <a href="/katalog">Katalog Kitab</a><span>/</span>
        ${categoryHref ? `<a href="${escapeHtml(categoryHref)}" dir="auto">${escapeHtml(book.category)}</a><span>/</span>` : ''}
        <span dir="auto">${escapeHtml(book.title)}</span>
      </nav>
      <article class="card">
        <h1 dir="auto">${escapeHtml(book.title)}</h1>
        <div class="meta">
          <div class="meta-item"><strong>Penulis</strong>${authorCell}</div>
          <div class="meta-item"><strong>Kategori</strong>${categoryCell}</div>
          <div class="meta-item"><strong>Jumlah Halaman</strong><span>${book.totalPages > 0 ? escapeHtml(book.totalPages.toLocaleString('id-ID')) : 'Belum tersedia'}</span></div>
          <div class="meta-item"><strong>ID Kitab</strong><span>#${escapeHtml(book.bkid)}</span></div>
        </div>
        <div class="actions">
          <a class="btn-read" href="/#/read/${escapeHtml(book.bkid)}">Baca Kitab</a>
          <a class="btn-secondary" href="/katalog">Jelajahi Katalog</a>
        </div>
      </article>
      ${summaryHtml}
      ${tocHtml}`;

  return renderSeoPage({
    title: book.title,
    description,
    canonicalUrl,
    ogType: 'book',
    siteUrl: base,
    jsonLd,
    bodyHtml,
  });
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
