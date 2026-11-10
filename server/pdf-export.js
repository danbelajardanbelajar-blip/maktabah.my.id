import { isArabicText } from './word-export.js';

export function generateBookHtmlPdf({ title = 'Kitab', author = '', higriYear = null, category = '', pages = [] } = {}) {
  const isTitleAr = isArabicText(title);
  const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const authorText = author
    ? (isArabicText(author)
        ? (higriYear ? `تأليف: ${author} (ت: ${higriYear} هـ)` : `تأليف: ${author}`)
        : (higriYear ? `Penulis: ${author} (w. ${higriYear} H)` : `Penulis: ${author}`))
    : '';

  const categoryText = category
    ? (isArabicText(category) ? `التصنيف: ${category}` : `Kategori: ${category}`)
    : '';

  const pagesHtml = pages.map((p, idx) => {
    const isHeaderAr = isTitleAr;
    const headerLabel = isHeaderAr
      ? `الجزء: ${p.juz || 1}  •  الصفحة: ${p.page || 1}`
      : `Juz: ${p.juz || 1}  |  Halaman: ${p.page || 1}`;

    const lines = (p.content || '').split(/\r\n|\n|\r|<br\s*\/?>|<\/br>|\u2028|\u2029/i);
    const linesHtml = lines.map(rawLine => {
      let line = rawLine.replace(/<[^>]*>?/gm, '').replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '').trim();
      if (!line) return '';
      const isAr = isArabicText(line);
      const cls = isAr ? 'line-arabic' : 'line-latin';
      const dir = isAr ? 'rtl' : 'ltr';
      return `<p class="${cls}" dir="${dir}">${escapeHtml(line)}</p>`;
    }).filter(Boolean).join('\n');

    return `
      <section class="book-page ${idx > 0 ? 'page-break' : ''}">
        <div class="page-banner" dir="${isHeaderAr ? 'rtl' : 'ltr'}">${escapeHtml(headerLabel)}</div>
        <div class="page-content">
          ${linesHtml}
        </div>
      </section>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${isTitleAr ? 'ar' : 'id'}" dir="${isTitleAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - PDF</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 20mm 15mm;
      @top-right {
        content: "${escapeHtml(title)}";
        font-family: 'Traditional Arabic', 'Amiri', serif;
        font-size: 9pt;
        color: #94a3b8;
      }
      @bottom-center {
        content: "المكتبة السنية | al Maktabah as Sunniyyah" "  •  " counter(page) " / " counter(pages);
        font-family: 'Traditional Arabic', 'Amiri', serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: #525659;
      font-family: 'Traditional Arabic', 'Amiri', 'Times New Roman', serif;
      color: #111827;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    /* Screen Container mimicking PDF reader */
    .screen-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 1000;
      font-family: 'Inter', sans-serif;
    }

    .screen-toolbar .title-info {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 60%;
    }

    .screen-toolbar .actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: background 0.2s;
    }

    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-secondary:hover {
      background: #475569;
    }

    .document-container {
      max-width: 210mm;
      margin: 20px auto;
      background: #ffffff;
      padding: 20mm 15mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      min-height: 297mm;
    }

    /* Cover / Header section */
    .book-title {
      font-size: 26pt;
      font-weight: bold;
      color: #1e3a8a;
      text-align: center;
      margin: 10mm 0 4mm 0;
      line-height: 1.3;
    }

    .book-author {
      font-size: 16pt;
      font-weight: bold;
      color: #475569;
      text-align: center;
      margin: 0 0 4mm 0;
    }

    .book-category {
      font-size: 12pt;
      color: #64748b;
      text-align: center;
      margin: 0 0 8mm 0;
      padding-bottom: 6mm;
      border-bottom: 2px solid #cbd5e1;
    }

    .book-divider {
      border: none;
      border-bottom: 1px solid #e2e8f0;
      margin: 0 0 8mm 0;
    }

    /* Page Sections */
    .book-page {
      margin-bottom: 12mm;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .page-banner {
      background-color: #f1f5f9 !important;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      color: #1e3a8a;
      font-weight: bold;
      font-size: 11pt;
      text-align: center;
      padding: 5px 12px;
      margin: 6mm 0 5mm 0;
      border-radius: 4px;
    }

    .page-content {
      padding: 0 2mm;
    }

    .line-arabic {
      font-family: 'Traditional Arabic', 'Amiri', serif;
      font-size: 18pt;
      line-height: 1.85;
      text-align: justify;
      direction: rtl;
      margin: 0 0 4mm 0;
      word-break: break-word;
    }

    .line-latin {
      font-family: 'Inter', 'Calibri', sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      text-align: left;
      direction: ltr;
      margin: 0 0 3mm 0;
    }

    /* Print Specific Media */
    @media print {
      body {
        background: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .document-container {
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .page-banner {
        background-color: #f1f5f9 !important;
      }
    }
  </style>
</head>
<body>
  <div class="screen-toolbar no-print">
    <div class="title-info">📄 ${escapeHtml(title)} - Pratinjau Cetak / PDF</div>
    <div class="actions">
      <button onclick="window.print()" class="btn btn-primary" title="Cetak atau Simpan sebagai PDF">
        🖨️ Simpan sebagai PDF
      </button>
      <button onclick="window.close()" class="btn btn-secondary" title="Tutup Halaman Ini">
        Tutup
      </button>
    </div>
  </div>

  <main class="document-container">
    <header class="book-header">
      <h1 class="book-title" dir="${isTitleAr ? 'rtl' : 'ltr'}">${escapeHtml(title)}</h1>
      ${authorText ? `<div class="book-author" dir="${isArabicText(author) ? 'rtl' : 'ltr'}">${escapeHtml(authorText)}</div>` : ''}
      ${categoryText ? `<div class="book-category" dir="${isArabicText(category) ? 'rtl' : 'ltr'}">${escapeHtml(categoryText)}</div>` : '<hr class="book-divider" />'}
    </header>

    <div class="book-body">
      ${pagesHtml}
    </div>
  </main>

  <script class="no-print">
    window.addEventListener('load', () => {
      // Auto-trigger print dialog after fonts are loaded
      if (window.location.search.includes('autoprint=0')) return;
      setTimeout(() => {
        try { window.print(); } catch(e) {}
      }, 700);
    });
  </script>
</body>
</html>`;
}
