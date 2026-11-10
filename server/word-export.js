import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  ShadingType
} = require('./vendor/docx.cjs');

export const ARABIC_FONT = 'Traditional Arabic';
export const LATIN_FONT = 'Calibri';

export const isArabicText = (text) =>
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');

export async function generateBookDocx({ title = 'Kitab', author = '', higriYear = null, category = '', pages = [] } = {}) {
  const docChildren = [];
  const isTitleAr = isArabicText(title);

  // 1. Judul Kitab
  docChildren.push(new Paragraph({
    children: [
      new TextRun({
        text: title || 'Kitab',
        font: isTitleAr ? ARABIC_FONT : LATIN_FONT,
        size: isTitleAr ? 52 : 44, // 26pt untuk Arab, 22pt untuk Latin
        bold: true,
        color: '1E3A8A', // Deep Navy
        rightToLeft: isTitleAr,
      })
    ],
    alignment: AlignmentType.CENTER,
    bidirectional: isTitleAr,
    spacing: { before: 240, after: 120 }
  }));

  // 2. Nama Penulis
  if (author) {
    const isAuthAr = isArabicText(author);
    const authorText = isAuthAr
      ? (higriYear ? `تأليف: ${author} (ت: ${higriYear} هـ)` : `تأليف: ${author}`)
      : (higriYear ? `Penulis: ${author} (w. ${higriYear} H)` : `Penulis: ${author}`);

    docChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: authorText,
          font: isAuthAr ? ARABIC_FONT : LATIN_FONT,
          size: isAuthAr ? 32 : 24, // 16pt / 12pt
          bold: true,
          color: '475569',
          rightToLeft: isAuthAr,
        })
      ],
      alignment: AlignmentType.CENTER,
      bidirectional: isAuthAr,
      spacing: { before: 0, after: 80 }
    }));
  }

  // 3. Kategori Kitab & Garis Pembatas
  if (category) {
    const isCatAr = isArabicText(category);
    docChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: isCatAr ? `التصنيف: ${category}` : `Kategori: ${category}`,
          font: isCatAr ? ARABIC_FONT : LATIN_FONT,
          size: isCatAr ? 24 : 20, // 12pt / 10pt
          color: '64748B',
          rightToLeft: isCatAr,
        })
      ],
      alignment: AlignmentType.CENTER,
      bidirectional: isCatAr,
      spacing: { before: 0, after: 280 },
      border: {
        bottom: { color: 'CBD5E1', space: 10, style: BorderStyle.SINGLE, size: 6 }
      }
    }));
  } else {
    // Garis pemisah halus jika tidak ada kategori
    docChildren.push(new Paragraph({
      text: '',
      spacing: { after: 240 },
      border: {
        bottom: { color: 'E2E8F0', space: 6, style: BorderStyle.SINGLE, size: 4 }
      }
    }));
  }

  // 4. Halaman-Halaman Kitab
  pages.forEach((p, idx) => {
    const isHeaderAr = isTitleAr;
    const headerLabel = isHeaderAr
      ? `الجزء: ${p.juz || 1}  •  الصفحة: ${p.page || 1}`
      : `Juz: ${p.juz || 1}  |  Halaman: ${p.page || 1}`;

    docChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: headerLabel,
          font: isHeaderAr ? ARABIC_FONT : LATIN_FONT,
          size: 22, // 11pt
          bold: true,
          color: '1E3A8A',
          rightToLeft: isHeaderAr,
        })
      ],
      alignment: AlignmentType.CENTER,
      bidirectional: isHeaderAr,
      pageBreakBefore: idx > 0, // Setiap halaman fisik kitab dimulai di lembar baru Word
      spacing: { before: idx === 0 ? 280 : 180, after: 140 },
      shading: {
        type: ShadingType.CLEAR,
        fill: 'F1F5F9', // Latar lembut
      },
      border: {
        top: { color: 'E2E8F0', space: 4, style: BorderStyle.SINGLE, size: 4 },
        bottom: { color: 'E2E8F0', space: 4, style: BorderStyle.SINGLE, size: 4 },
      }
    }));

    const lines = (p.content || '').split(/\r\n|\n|\r|<br\s*\/?>|<\/br>|\u2028|\u2029/i);
    for (const rawLine of lines) {
      let line = rawLine.replace(/<[^>]*>?/gm, '');
      line = line.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();

      if (line) {
        const isAr = isArabicText(line);
        docChildren.push(new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: isAr ? ARABIC_FONT : LATIN_FONT,
              size: isAr ? 36 : 24, // 18pt untuk teks Arab agar harakat terbaca jelas; 12pt Latin
              rightToLeft: isAr,
            })
          ],
          alignment: isAr ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
          bidirectional: isAr,
          spacing: {
            before: 60,
            after: 60,
            line: isAr ? 380 : 280, // Jarak antar-baris lega untuk tanda baca/harakat Arab
            lineRule: 'auto',
          }
        }));
      }
    }
  });

  // 5. Running Header (Judul Kitab di sudut atas)
  const runningHeader = new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: title || 'Kitab',
            font: isTitleAr ? ARABIC_FONT : LATIN_FONT,
            size: 18, // 9pt
            color: '94A3B8',
            rightToLeft: isTitleAr,
          })
        ],
        alignment: isTitleAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: isTitleAr,
        spacing: { after: 100 },
        border: {
          bottom: { color: 'E2E8F0', space: 4, style: BorderStyle.SINGLE, size: 4 }
        }
      })
    ]
  });

  // 6. Running Footer (Nama Situs + Nomor Halaman Dinamis Word)
  const runningFooter = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: 'المكتبة السنية | al Maktabah as Sunniyyah',
            font: ARABIC_FONT,
            size: 16, // 8pt
            color: '94A3B8',
          }),
          new TextRun({
            text: '     •     ',
            size: 16,
            color: 'CBD5E1',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            bold: true,
            color: '64748B',
          }),
          new TextRun({
            text: ' / ',
            size: 18,
            color: '94A3B8',
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: '94A3B8',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        border: {
          top: { color: 'E2E8F0', space: 4, style: BorderStyle.SINGLE, size: 4 }
        }
      })
    ]
  });

  // 7. Konstruksi Dokumen A4 dengan Margin Standar
  const doc = new Document({
    creator: author || 'al Maktabah as Sunniyyah',
    title: title || 'Kitab',
    description: 'Diunduh dari al Maktabah as Sunniyyah (maktabah.my.id)',
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inci (2.54 cm)
            bottom: 1440, // 1 inci (2.54 cm)
            left: 1440,   // 1 inci (2.54 cm)
            right: 1440,  // 1 inci (2.54 cm)
          }
        }
      },
      headers: {
        default: runningHeader,
      },
      footers: {
        default: runningFooter,
      },
      children: docChildren,
    }]
  });

  return await Packer.toBuffer(doc);
}
