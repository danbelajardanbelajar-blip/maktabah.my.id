import { withRowaSources } from './rowa-codes.js';
import { hadithBooks } from './hadith-books.js';
import {
  normalizeSiteUrl,
  slugifyTitle,
  escapeHtml,
  cleanText,
  renderUnavailableHtml,
  renderSeoPage,
} from './seo-utils.js';

function parsePositiveIdSlug(raw) {
  const match = /^([1-9]\d*)(?:-(.*))?$/.exec(raw || '');
  return match ? Number(match[1]) : null;
}

function parsePage(raw) {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(10000, n) : 1;
}

function unavailable(res, message) {
  return res.status(503)
    .set('Retry-After', '60')
    .set('Cache-Control', 'no-store')
    .type('text/html; charset=utf-8')
    .send(renderUnavailableHtml(message));
}

function renderPagination(basePath, page, totalPages) {
  if (totalPages <= 1) return '';
  const prev = page > 1 ? `<a href="${escapeHtml(page === 2 ? basePath : `${basePath}?page=${page - 1}`)}">← Sebelumnya</a>` : '';
  const next = page < totalPages ? `<a href="${escapeHtml(`${basePath}?page=${page + 1}`)}">Berikutnya →</a>` : '';
  return `<nav class="pagination" aria-label="Halaman">${prev}<span>Halaman ${page} dari ${totalPages}</span>${next}</nav>`;
}

/**
 * Register Stage-3 public SEO routes for authors, rowa, categories, katalog, and kutub-hadis.
 */
export function registerDirectorySeoRoutes(app, {
  getDb,
  booksMeta,
  getRowaDb,
  authorService,
  isMaintenance,
  siteUrl,
}) {
  const canonicalBase = normalizeSiteUrl(siteUrl || process.env.SITE_URL);
  const cache = new Map();

  function assertReady(db) {
    if (isMaintenance?.()) {
      const err = new Error('Layanan sedang dalam pemeliharaan atau transfer data.');
      err.status = 503;
      throw err;
    }
    if (!db) {
      const err = new Error('Database sementara tidak tersedia.');
      err.status = 503;
      throw err;
    }
  }

  // 1. /penulis & /penulis/:idSlug (read-only via authorService)
  app.get('/penulis', (req, res) => {
    try {
      assertReady(getDb());
      const page = parsePage(req.query.page);
      const data = authorService.authorList({ page: String(page), limit: '30', sort: 'name' });
      const totalPages = Math.max(1, data.totalPages || 1);
      const pathWithPage = page > 1 ? `/penulis?page=${page}` : '/penulis';
      const canonicalUrl = `${canonicalBase}${pathWithPage}`;
      const listHtml = data.data.map((a) => {
        const href = `/penulis/${a.id}-${slugifyTitle(a.name, 'penulis')}`;
        const death = a.deathDate?.label ? ` · ${escapeHtml(a.deathDate.label)}` : '';
        return `<li class="list-item"><a href="${escapeHtml(href)}" dir="auto">${escapeHtml(a.name)}</a><div class="list-sub">${a.workCount || 0} karya${death}</div></li>`;
      }).join('\n');

      const bodyHtml = `
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Beranda</a><span>/</span><span>Penulis &amp; Karya</span></nav>
        <section class="card">
          <h1>Direktori Penulis &amp; Ulama</h1>
          <p>${data.total.toLocaleString('id-ID')} profil penulis terdaftar di al Maktabah as Sunniyyah.</p>
          <div class="actions"><a class="btn-read" href="/#/penulis">Buka Mode Interaktif</a></div>
        </section>
        <section class="card">
          <ul class="list-grid">${listHtml}</ul>
          ${renderPagination('/penulis', page, totalPages)}
        </section>`;

      return res.status(200)
        .set('Cache-Control', 'public, max-age=300')
        .type('text/html; charset=utf-8')
        .send(renderSeoPage({
          title: page > 1 ? `Penulis & Ulama (Halaman ${page})` : 'Penulis & Ulama',
          description: `Jelajahi ${data.total.toLocaleString('id-ID')} profil ulama dan penulis kitab Islam klasik beserta daftar karyanya di al Maktabah as Sunniyyah.`,
          canonicalUrl,
          siteUrl: canonicalBase,
          bodyHtml,
        }));
    } catch (error) {
      return unavailable(res, error.message || 'Layanan penulis sementara tidak tersedia.');
    }
  });

  app.get('/penulis/:idSlug', (req, res, next) => {
    const id = parsePositiveIdSlug(req.params.idSlug);
    if (!id) return next();

    let result;
    try {
      assertReady(getDb());
      result = authorService.detail(id, { limit: '60', page: '1' });
    } catch (error) {
      if (error.status === 404) return next();
      return unavailable(res, error.message || 'Layanan penulis sementara tidak tersedia.');
    }

    const author = result.data;
    const slug = slugifyTitle(author.name, 'penulis');
    const canonicalPath = `/penulis/${author.id}-${slug}`;
    if (req.params.idSlug !== `${author.id}-${slug}`) {
      return res.redirect(301, canonicalPath);
    }

    const canonicalUrl = `${canonicalBase}${canonicalPath}`;
    const bio = cleanText(author.biography, 2000);
    const worksHtml = result.works.length
      ? `<section class="card">
          <h2>Karya Tersedia (${result.total})</h2>
          <ul class="list-grid">
            ${result.works.map((w) => {
              const href = `/kitab/${w.book_id}-${slugifyTitle(w.title)}`;
              return `<li class="list-item"><a href="${escapeHtml(href)}" dir="auto">${escapeHtml(w.title)}</a><div class="list-sub"><span class="badge">${escapeHtml(w.status === 'confirmed' ? 'Terverifikasi' : 'Metadata')}</span></div></li>`;
            }).join('\n')}
          </ul>
        </section>`
      : '';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          name: author.name,
          url: canonicalUrl,
          ...(bio ? { description: cleanText(bio, 300) } : {}),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${canonicalBase}/` },
            { '@type': 'ListItem', position: 2, name: 'Penulis', item: `${canonicalBase}/penulis` },
            { '@type': 'ListItem', position: 3, name: author.name, item: canonicalUrl },
          ],
        },
      ],
    };

    const bodyHtml = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Beranda</a><span>/</span>
        <a href="/penulis">Penulis</a><span>/</span>
        <span dir="auto">${escapeHtml(author.name)}</span>
      </nav>
      <article class="card">
        <h1 dir="auto">${escapeHtml(author.name)}</h1>
        <div class="meta">
          <div class="meta-item"><strong>Wafat</strong><span>${escapeHtml(author.deathDate?.label || 'Belum tercatat')}</span></div>
          <div class="meta-item"><strong>Jumlah Karya</strong><span>${escapeHtml(result.total)} kitab</span></div>
          ${author.sourceRef ? `<div class="meta-item"><strong>Sumber</strong><span dir="auto">${escapeHtml(cleanText(author.sourceRef, 120))}</span></div>` : ''}
        </div>
        <div class="actions">
          <a class="btn-read" href="/#/penulis?id=${escapeHtml(author.id)}">Buka Profil Interaktif</a>
        </div>
      </article>
      ${bio ? `<section class="card"><h2>Biografi</h2><p class="summary" dir="auto">${escapeHtml(bio)}</p></section>` : ''}
      ${worksHtml}`;

    return res.status(200)
      .set('Cache-Control', 'public, max-age=300')
      .type('text/html; charset=utf-8')
      .send(renderSeoPage({
        title: author.name,
        description: cleanText(`Biografi ${author.name}${author.deathDate?.label ? ` (${author.deathDate.label})` : ''} beserta ${result.total} karya kitabnya di al Maktabah as Sunniyyah.`, 160),
        canonicalUrl,
        ogType: 'profile',
        siteUrl: canonicalBase,
        jsonLd,
        bodyHtml,
      }));
  });

  // 2. /perawi & /perawi/:idSlug (read-only, zero rowa_logs writes)
  app.get('/perawi', (req, res) => {
    try {
      assertReady(getRowaDb());
      const rowaDb = getRowaDb();
      const page = parsePage(req.query.page);
      const limit = 30;
      const offset = (page - 1) * limit;
      const total = rowaDb.prepare('SELECT COUNT(*) as c FROM rowa').get().c || 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const rows = rowaDb.prepare('SELECT id, Name, TABAQ, DEATH FROM rowa ORDER BY id ASC LIMIT ? OFFSET ?').all(limit, offset);
      const pathWithPage = page > 1 ? `/perawi?page=${page}` : '/perawi';
      const canonicalUrl = `${canonicalBase}${pathWithPage}`;

      const listHtml = rows.map((r) => {
        const name = cleanText(r.Name) || `Perawi #${r.id}`;
        const href = `/perawi/${r.id}-${slugifyTitle(name, 'perawi')}`;
        const info = [cleanText(r.TABAQ), cleanText(r.DEATH)].filter(Boolean).join(' · ');
        return `<li class="list-item"><a href="${escapeHtml(href)}" dir="auto">${escapeHtml(name)}</a>${info ? `<div class="list-sub" dir="auto">${escapeHtml(info)}</div>` : ''}</li>`;
      }).join('\n');

      const bodyHtml = `
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Beranda</a><span>/</span><span>Kamus Perawi</span></nav>
        <section class="card">
          <h1>Kamus Perawi Hadis</h1>
          <p>${total.toLocaleString('id-ID')} entri perawi hadis bersumber dari kitab-kitab rijal klasik.</p>
          <div class="actions"><a class="btn-read" href="/#/perawi">Buka Mode Interaktif</a></div>
        </section>
        <section class="card">
          <ul class="list-grid">${listHtml}</ul>
          ${renderPagination('/perawi', page, totalPages)}
        </section>`;

      return res.status(200)
        .set('Cache-Control', 'public, max-age=300')
        .type('text/html; charset=utf-8')
        .send(renderSeoPage({
          title: page > 1 ? `Kamus Perawi Hadis (Halaman ${page})` : 'Kamus Perawi Hadis',
          description: `Telusuri ${total.toLocaleString('id-ID')} biografi perawi hadis, kunyah, tabaqah, dan jarh wa ta'dil di al Maktabah as Sunniyyah.`,
          canonicalUrl,
          siteUrl: canonicalBase,
          bodyHtml,
        }));
    } catch (error) {
      return unavailable(res, error.message || 'Database perawi sementara tidak tersedia.');
    }
  });

  app.get('/perawi/:idSlug', (req, res, next) => {
    const id = parsePositiveIdSlug(req.params.idSlug);
    if (!id) return next();

    let row;
    try {
      const rowaDb = getRowaDb();
      assertReady(rowaDb);
      row = rowaDb.prepare('SELECT * FROM rowa WHERE id = ? LIMIT 1').get(id);
    } catch (error) {
      return unavailable(res, error.message || 'Database perawi sementara tidak tersedia.');
    }

    if (!row) return next();
    const data = withRowaSources(row);
    const name = cleanText(data.Name || data.name) || `Perawi #${id}`;
    const slug = slugifyTitle(name, 'perawi');
    const canonicalPath = `/perawi/${id}-${slug}`;
    if (req.params.idSlug !== `${id}-${slug}`) {
      return res.redirect(301, canonicalPath);
    }

    const canonicalUrl = `${canonicalBase}${canonicalPath}`;
    const aqual = cleanText(data.AQUAL, 3000);
    const sources = Array.isArray(data.who_sources) ? data.who_sources.map((s) => s.label || s.code).filter(Boolean) : [];

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          name,
          url: canonicalUrl,
          ...(aqual ? { description: cleanText(aqual, 300) } : {}),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${canonicalBase}/` },
            { '@type': 'ListItem', position: 2, name: 'Kamus Perawi', item: `${canonicalBase}/perawi` },
            { '@type': 'ListItem', position: 3, name, item: canonicalUrl },
          ],
        },
      ],
    };

    const bodyHtml = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Beranda</a><span>/</span>
        <a href="/perawi">Kamus Perawi</a><span>/</span>
        <span dir="auto">${escapeHtml(name)}</span>
      </nav>
      <article class="card">
        <h1 dir="auto">${escapeHtml(name)}</h1>
        <div class="meta">
          ${data.KUNIA ? `<div class="meta-item"><strong>Kunyah</strong><span dir="auto">${escapeHtml(cleanText(data.KUNIA))}</span></div>` : ''}
          ${data.TABAQ ? `<div class="meta-item"><strong>Tabaqah</strong><span dir="auto">${escapeHtml(cleanText(data.TABAQ))}</span></div>` : ''}
          ${data.DEATH ? `<div class="meta-item"><strong>Wafat</strong><span dir="auto">${escapeHtml(cleanText(data.DEATH))}</span></div>` : ''}
          ${data.ROTB ? `<div class="meta-item"><strong>Derajat</strong><span dir="auto">${escapeHtml(cleanText(data.ROTB))}</span></div>` : ''}
        </div>
        ${sources.length ? `<p>${sources.map((s) => `<span class="badge">${escapeHtml(s)}</span>`).join('')}</p>` : ''}
        <div class="actions">
          <a class="btn-read" href="/#/perawi?id=${escapeHtml(id)}">Buka di Kamus Perawi</a>
        </div>
      </article>
      ${aqual ? `<section class="card"><h2>Keterangan Rijal &amp; Jarh wa Ta'dil</h2><p class="summary" dir="auto">${escapeHtml(aqual)}</p></section>` : ''}`;

    return res.status(200)
      .set('Cache-Control', 'public, max-age=300')
      .type('text/html; charset=utf-8')
      .send(renderSeoPage({
        title: `${name} — Kamus Perawi`,
        description: cleanText(`Biografi perawi hadis ${name}${sources.length ? ` (periwayat di ${sources.slice(0, 3).join(', ')})` : ''} di al Maktabah as Sunniyyah.`, 160),
        canonicalUrl,
        ogType: 'profile',
        siteUrl: canonicalBase,
        jsonLd,
        bodyHtml,
      }));
  });

  // 3. /katalog & /kategori/:idSlug
  app.get('/katalog', (_req, res) => {
    try {
      const db = getDb();
      assertReady(db);
      let cats = cache.get('katalog');
      if (!cats) {
        cats = db.prepare(`SELECT c.id, c.name, COUNT(b.bkid) as book_count FROM main.categories c LEFT JOIN ${booksMeta()} b ON b.cat = c.id GROUP BY c.id, c.name ORDER BY c.name ASC`).all();
        cache.set('katalog', cats);
      }

      const listHtml = cats.map((c) => {
        const href = `/kategori/${c.id}-${slugifyTitle(c.name, 'kategori')}`;
        return `<li class="list-item"><a href="${escapeHtml(href)}" dir="auto">${escapeHtml(c.name)}</a><div class="list-sub">${Number(c.book_count || 0).toLocaleString('id-ID')} kitab</div></li>`;
      }).join('\n');

      const bodyHtml = `
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Beranda</a><span>/</span><span>Katalog Kitab</span></nav>
        <section class="card">
          <h1>Katalog Kategori Kitab</h1>
          <p>Pilih kategori keilmuan Islam untuk menelusuri daftar kitab yang tersedia.</p>
          <div class="actions"><a class="btn-read" href="/#/katalog">Buka Katalog Interaktif</a></div>
        </section>
        <section class="card"><ul class="list-grid">${listHtml}</ul></section>`;

      return res.status(200)
        .set('Cache-Control', 'public, max-age=300')
        .type('text/html; charset=utf-8')
        .send(renderSeoPage({
          title: 'Katalog Kitab',
          description: 'Katalog lengkap kategori kitab Islam klasik di al Maktabah as Sunniyyah: Tafsir, Hadis, Fiqih, Akidah, Tasawuf, dan Bahasa Arab.',
          canonicalUrl: `${canonicalBase}/katalog`,
          siteUrl: canonicalBase,
          bodyHtml,
        }));
    } catch (error) {
      return unavailable(res, error.message || 'Katalog sementara tidak tersedia.');
    }
  });

  app.get('/kategori/:idSlug', (req, res, next) => {
    const id = parsePositiveIdSlug(req.params.idSlug);
    if (!id) return next();

    try {
      const db = getDb();
      assertReady(db);
      const cat = db.prepare('SELECT id, name FROM main.categories WHERE id = ? LIMIT 1').get(id);
      if (!cat) return next();

      const slug = slugifyTitle(cat.name, 'kategori');
      const basePath = `/kategori/${cat.id}-${slug}`;
      if (req.params.idSlug !== `${cat.id}-${slug}`) {
        const q = req.query.page ? `?page=${parsePage(req.query.page)}` : '';
        return res.redirect(301, `${basePath}${q}`);
      }

      const page = parsePage(req.query.page);
      const limit = 30;
      const offset = (page - 1) * limit;
      const total = db.prepare(`SELECT COUNT(*) as c FROM ${booksMeta()} WHERE cat = ?`).get(id).c || 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const books = db.prepare(`SELECT bkid, bk FROM ${booksMeta()} WHERE cat = ? ORDER BY bk ASC LIMIT ? OFFSET ?`).all(id, limit, offset);

      const listHtml = books.map((b) => {
        const href = `/kitab/${b.bkid}-${slugifyTitle(b.bk)}`;
        return `<li class="list-item"><a href="${escapeHtml(href)}" dir="auto">${escapeHtml(b.bk)}</a><div class="list-sub">ID #${b.bkid}</div></li>`;
      }).join('\n');

      const canonicalPath = page > 1 ? `${basePath}?page=${page}` : basePath;
      const bodyHtml = `
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Beranda</a><span>/</span>
          <a href="/katalog">Katalog</a><span>/</span>
          <span dir="auto">${escapeHtml(cat.name)}</span>
        </nav>
        <section class="card">
          <h1 dir="auto">Kategori: ${escapeHtml(cat.name)}</h1>
          <p>${total.toLocaleString('id-ID')} kitab tersedia dalam kategori ini.</p>
          <div class="actions"><a class="btn-read" href="/#/katalog?cat=${escapeHtml(cat.id)}">Filter di Aplikasi</a></div>
        </section>
        <section class="card">
          <ul class="list-grid">${listHtml}</ul>
          ${renderPagination(basePath, page, totalPages)}
        </section>`;

      return res.status(200)
        .set('Cache-Control', 'public, max-age=300')
        .type('text/html; charset=utf-8')
        .send(renderSeoPage({
          title: page > 1 ? `${cat.name} (Halaman ${page})` : cat.name,
          description: cleanText(`Daftar ${total.toLocaleString('id-ID')} kitab dalam kategori ${cat.name} di al Maktabah as Sunniyyah.`, 160),
          canonicalUrl: `${canonicalBase}${canonicalPath}`,
          siteUrl: canonicalBase,
          bodyHtml,
        }));
    } catch (error) {
      return unavailable(res, error.message || 'Kategori sementara tidak tersedia.');
    }
  });

  // 4. /kutub-hadis
  app.get('/kutub-hadis', (_req, res) => {
    try {
      const db = getDb();
      assertReady(db);
      const library = db.prepare(`SELECT bkid, bk FROM ${booksMeta()}`).all();
      const { books } = hadithBooks(library);

      const sectionsHtml = books.map((item) => {
        const editionsHtml = item.editions.length
          ? `<ul class="list-grid">${item.editions.map((e) => `<li class="list-item"><a href="/kitab/${e.id}-${escapeHtml(slugifyTitle(e.title))}" dir="auto">${escapeHtml(e.title)}</a></li>`).join('')}</ul>`
          : '<p class="list-sub">Belum ada edisi tersedia di pustaka saat ini.</p>';
        return `<section class="card"><h2 dir="auto">${escapeHtml(item.arabic || item.name || item.id)}</h2>${item.name ? `<p class="list-sub">${escapeHtml(item.name)}</p>` : ''}${editionsHtml}</section>`;
      }).join('\n');

      const bodyHtml = `
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Beranda</a><span>/</span><span>Kutub Hadis</span></nav>
        <section class="card">
          <h1>Kutub Hadis (Kitab Induk Hadis)</h1>
          <p>Koleksi kitab-kitab induk hadis beserta daftar edisi yang tersedia di al Maktabah as Sunniyyah.</p>
          <div class="actions"><a class="btn-read" href="/#/kutub-hadis">Buka Pencarian Hadis</a></div>
        </section>
        ${sectionsHtml}`;

      return res.status(200)
        .set('Cache-Control', 'public, max-age=300')
        .type('text/html; charset=utf-8')
        .send(renderSeoPage({
          title: 'Kutub Hadis',
          description: 'Daftar kitab induk hadis (Kutub Tis\'ah dan lainnya) beserta edisi yang tersedia di al Maktabah as Sunniyyah.',
          canonicalUrl: `${canonicalBase}/kutub-hadis`,
          siteUrl: canonicalBase,
          bodyHtml,
        }));
    } catch (error) {
      return unavailable(res, error.message || 'Kutub Hadis sementara tidak tersedia.');
    }
  });

  return { invalidate: () => cache.clear() };
}
