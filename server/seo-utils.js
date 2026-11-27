export const DEFAULT_SITE_URL = 'https://maktab.my.id';

export function normalizeSiteUrl(raw) {
  const value = String(raw || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  return value || DEFAULT_SITE_URL;
}

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
 * Convert an Arabic or Latin title/name into a clean ASCII URL slug.
 * @param {string} title
 * @param {string} [fallback='item']
 * @returns {string}
 */
export function slugifyTitle(title, fallback = 'kitab') {
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

  return slug || fallback;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cleanText(value, maxLen = 0) {
  const text = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!maxLen || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

export function renderUnavailableHtml(message) {
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

export function renderSeoPage({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  siteUrl = DEFAULT_SITE_URL,
  jsonLd = null,
  bodyHtml = '',
  robots = '',
}) {
  const base = normalizeSiteUrl(siteUrl);
  const fullTitle = `${title} — al Maktabah as Sunniyyah`;
  const robotsMeta = robots ? `\n    <meta name="robots" content="${escapeHtml(robots)}" />` : '';
  const ldScript = jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />${robotsMeta}
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:site_name" content="al Maktabah as Sunniyyah" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(`${base}/logo.png`)}" />
    <meta property="og:locale" content="id_ID" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${base}/logo.png`)}" />${ldScript}
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#f4f7f5;color:#1e293b;font:16px/1.7 system-ui,-apple-system,sans-serif}
      header,main,footer{max-width:920px;margin:auto;padding:20px}
      header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .brand{font-weight:700;color:#065f46;text-decoration:none;font-size:15px}
      .nav-links{display:flex;gap:14px;font-size:14px;flex-wrap:wrap}
      .nav-links a{color:#047857;text-decoration:none}
      .breadcrumb{font-size:13px;color:#64748b;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:6px}
      .breadcrumb a{color:#047857;text-decoration:none}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px;box-shadow:0 2px 10px rgba(15,23,42,.04)}
      h1{margin:0 0 14px;font-size:28px;line-height:1.45;color:#064e3b}
      h2{margin:0 0 12px;font-size:19px;color:#065f46}
      .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0 22px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
      .meta-item strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
      .meta-item span,.meta-item a{font-weight:600;color:#0f172a;text-decoration:none}
      .meta-item a{color:#047857}
      .actions{display:flex;gap:12px;flex-wrap:wrap}
      .btn-read{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:10px;background:#047857;color:#fff;font-weight:700;text-decoration:none}
      .btn-secondary{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-weight:600;text-decoration:none}
      .summary{margin:0;white-space:pre-line}
      .list-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;list-style:none;padding:0;margin:0}
      .list-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
      .list-item a{color:#064e3b;font-weight:700;text-decoration:none;display:block}
      .list-item a:hover{text-decoration:underline}
      .list-sub{font-size:13px;color:#64748b;margin-top:4px}
      .badge{display:inline-block;font-size:12px;padding:2px 8px;border-radius:999px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;margin-inline-end:6px}
      .toc-list{margin:0;padding-inline-start:22px}
      .toc-list li{margin:6px 0}
      .toc-lvl-2{margin-inline-start:16px}
      .toc-lvl-3,.toc-lvl-4{margin-inline-start:32px;color:#475569}
      .pagination{display:flex;gap:10px;justify-content:center;align-items:center;margin-top:20px;flex-wrap:wrap}
      .pagination a{padding:8px 14px;border-radius:8px;background:#fff;border:1px solid #cbd5e1;color:#047857;text-decoration:none;font-weight:600;font-size:14px}
      footer{font-size:13px;color:#64748b;text-align:center;padding-bottom:32px}
      footer a{color:#047857;text-decoration:none}
      @media(max-width:600px){.card{padding:18px}h1{font-size:23px}}
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">al Maktabah as Sunniyyah · <span lang="ar" dir="rtl">المكتبة السنية</span></a>
      <nav class="nav-links" aria-label="Navigasi">
        <a href="/katalog">Katalog</a>
        <a href="/kutub-hadis">Kutub Hadis</a>
        <a href="/penulis">Penulis</a>
        <a href="/perawi">Perawi</a>
      </nav>
    </header>
    <main>
      ${bodyHtml}
    </main>
    <footer>
      <a href="/">maktab.my.id</a> · <a href="/katalog">Katalog</a> · <a href="/privacy-policy">Kebijakan Privasi</a>
    </footer>
  </body>
</html>
`;
}
