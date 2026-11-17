import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import { buildBook, parseDocx, parseParagraphs, parseStyles, readZip, wordToBook, WORD_LIMITS } from './docx-import.js';
import { registerBookTransfer } from './book-transfer.js';

const require = createRequire(import.meta.url);
const { Document, Packer, Paragraph, TextRun, HeadingLevel, FootnoteReferenceRun, PageBreak } = require('./vendor/docx.cjs');

// A realistic Word file made by the same library the Word export uses.
async function sampleDocx() {
  const doc = new Document({
    title: 'كتاب التجربة',
    footnotes: { 1: { children: [new Paragraph('رواه البخاري')] } },
    sections: [{ children: [
      new Paragraph({ text: 'المقدمة', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ children: [new TextRun('الحمد لله رب العالمين'), new FootnoteReferenceRun(1)] }),
      new Paragraph('وصلى الله على نبينا محمد & آله <وصحبه>'),
      new Paragraph({ text: 'باب الطهارة', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'فصل في المياه', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ children: [new TextRun('الماء طهور'), new PageBreak(), new TextRun('بعد فاصل الصفحة')] }),
    ] }],
  });
  return Packer.toBuffer(doc);
}

// Minimal hand-made ZIP for edge cases (stored or deflated entries).
function zip(files, deflate = true) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text), data = deflate ? zlib.deflateRawSync(raw) : raw, nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(deflate ? 8 : 0, 10);
    entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(raw.length, 24); entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data); central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const body = inner => `<?xml version="1.0"?><w:document ${W}><w:body>${inner}</w:body></w:document>`;

test('a real Word file becomes pages with headings as table of contents and footnotes per page', async () => {
  const book = wordToBook(await sampleDocx(), { fileName: 'tes.docx' });
  assert.equal(book.guessedTitle, 'كتاب التجربة');
  assert.deepEqual(book.titles.map(t => [t.lvl, t.tit]), [[1, 'المقدمة'], [1, 'باب الطهارة'], [2, 'فصل في المياه']]);
  assert.deepEqual(book.titles.map(t => t.id), [1, 2, 3], 'one heading per page, as the library stores the contents');
  assert.equal(book.pages[0].nass, 'المقدمة\rالحمد لله رب العالمين(1)\rوصلى الله على نبينا محمد & آله <وصحبه>\r__________\r(1) رواه البخاري');
  assert.equal(book.pages[2].nass, 'فصل في المياه\rالماء طهور');
  assert.equal(book.pages[3].nass, 'بعد فاصل الصفحة', 'an explicit page break starts a new page');
  assert.deepEqual(book.pages.map(p => [p.id, p.part, p.page]), [[1, 1, 1], [2, 1, 2], [3, 1, 3], [4, 1, 4]]);
  assert.equal(book.footnotes, 1);
  assert.deepEqual(book.warnings, []);
});

test('deleted revisions, field codes and duplicate textbox fallbacks are not imported', () => {
  const paragraphs = parseParagraphs(body(`<w:p><w:r><w:t>أ</w:t></w:r><w:del><w:r><w:delText>محذوف</w:delText></w:r></w:del>
    <w:r><w:instrText> PAGE </w:instrText></w:r><w:ins><w:r><w:t xml:space="preserve"> ب</w:t></w:r></w:ins>
    <mc:AlternateContent><mc:Choice><w:r><w:t>ج</w:t></w:r></mc:Choice><mc:Fallback><w:r><w:t>ج</w:t></w:r></mc:Fallback></mc:AlternateContent>
    <w:r><w:tab/><w:t>&#1583;&#x062F;</w:t><w:br/><w:t>هـ</w:t></w:r></w:p><w:p/>`));
  assert.deepEqual(paragraphs.map(p => p.text), ['أ بج\tدد\rهـ', '']);
});

test('heading levels come from heading styles, outline levels and inherited styles', () => {
  const styles = parseStyles(`<w:styles ${W}>
    <w:style w:type="paragraph" w:styleId="Judul1"><w:name w:val="heading 1"/></w:style>
    <w:style w:type="paragraph" w:styleId="Bab"><w:name w:val="Bab Kitab"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="BabMerah"><w:name w:val="Bab Merah"/><w:basedOn w:val="Bab"/></w:style>
    <w:style w:type="paragraph" w:styleId="Isi"><w:name w:val="Normal"/><w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style></w:styles>`);
  assert.deepEqual([...styles].map(([id, s]) => [id, s.level, s.title]), [['Judul1', 1, false], ['Bab', 2, false], ['BabMerah', 2, false], ['Isi', 0, false], ['Title', 1, true]]);
});

test('without headings, long text is split near 4,000 characters on sentence boundaries and a warning explains it', () => {
  const sentence = 'هذا نص طويل للتجربة. ';
  const text = sentence.repeat(600);
  const book = buildBook({ paragraphs: [{ text, level: 0, title: false, pageBreakBefore: false }], notes: new Map(), coreTitle: '' }, { fileName: 'نص.docx' });
  assert.ok(book.pages.length >= 3);
  assert.ok(book.pages.every(p => p.nass.length <= WORD_LIMITS.pageChars));
  assert.ok(book.pages.slice(0, -1).every(p => p.nass.endsWith('.')));
  assert.equal(book.pages.map(p => p.nass).join(' ').replace(/\s+/g, ' '), text.trim());
  assert.equal(book.titles.length, 0);
  assert.equal(book.guessedTitle, 'نص');
  assert.match(book.warnings[0], /Heading/);
});

test('"follow Word pages" splits where Word last rendered a page break', () => {
  const xml = body('<w:p><w:r><w:t>صفحة أولى</w:t></w:r></w:p><w:p><w:r><w:lastRenderedPageBreak/><w:t>صفحة ثانية</w:t></w:r></w:p>');
  const file = zip({ 'word/document.xml': xml });
  assert.deepEqual(wordToBook(file, { split: 'heading' }).pages.map(p => p.nass), ['صفحة أولى\rصفحة ثانية']);
  assert.deepEqual(wordToBook(file, { split: 'word' }).pages.map(p => p.nass), ['صفحة أولى', 'صفحة ثانية']);
  assert.throws(() => wordToBook(file, { split: 'lain' }), /tidak valid/);
});

test('invalid, empty and oversized files are rejected with clear messages', () => {
  assert.throws(() => readZip(Buffer.from('bukan zip sama sekali, ini teks biasa'), new Set()), /bukan dokumen Word/);
  assert.throws(() => parseDocx(zip({ 'lain.txt': 'x' })), /\.doc lama/);
  assert.throws(() => wordToBook(zip({ 'word/document.xml': body('<w:p/>') })), /tidak berisi teks/);
  assert.deepEqual(wordToBook(zip({ 'word/document.xml': body('<w:p><w:r><w:t>نص</w:t></w:r></w:p>') }, false)).pages.map(p => p.nass), ['نص'], 'stored (uncompressed) entries work too');
  // A small file that inflates beyond the limit (zip bomb) is refused.
  const bomb = zip({ 'word/document.xml': body(`<w:p><w:r><w:t>${'ا'.repeat(WORD_LIMITS.entryBytes / 2 + 10)}</w:t></w:r></w:p>`) });
  assert.throws(() => parseDocx(bomb), /terlalu besar|tidak dapat dibuka/);
});

const seed = fileURLToPath(new URL('../dev-data/seed/maktabah.db', import.meta.url));
test('admin preview stores nothing; import creates a readable, searchable book with backup', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-word-'));
  const filename = path.join(directory, 'test.db');
  fs.copyFileSync(seed, filename);
  const db = new Database(filename);
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const app = express();
  app.use(express.json({ limit: '100mb' }));
  registerBookTransfer(app, {
    getDb: () => db, getDbPath: () => filename,
    requireAdmin: (req, res, next) => req.headers.authorization === 'Bearer test' ? next() : res.sendStatus(401),
    hasAdditional: () => false, clearCache: () => {},
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/books/word/`;
  const post = (action, payload, auth = 'Bearer test') => fetch(base + action, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${(await sampleDocx()).toString('base64')}`;
  const books = () => db.prepare('SELECT count(*) AS n FROM books_meta').get().n;
  const before = books();

  assert.equal((await post('preview', { data }, 'Bearer salah')).status, 401);
  assert.equal((await post('import', { data }, 'Bearer salah')).status, 401);
  const preview = await (await post('preview', { data, fileName: 'tes.docx' })).json();
  assert.equal(preview.pages, 4);assert.equal(preview.titles, 3);assert.equal(preview.guessedTitle, 'كتاب التجربة');
  assert.deepEqual(preview.toc[2], { page: 3, lvl: 2, tit: 'فصل في المياه' });
  assert.equal(books(), before, 'preview stores nothing');

  const category = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  assert.equal((await post('import', { data, title: '  ', categoryId: category })).status, 400);
  assert.equal((await post('import', { data, title: 'كتاب', categoryId: 99999999 })).status, 400);
  assert.equal((await post('preview', { data: 'data:;base64,' + Buffer.from('teks').toString('base64') })).status, 400);

  const maxId = db.prepare('SELECT max(bkid) AS n FROM books_meta').get().n;
  const response = await post('import', { data, fileName: 'tes.docx', title: ' كتاب   التجربة ', author: 'مؤلف تجريبي جديد', categoryId: category });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.bkid, maxId + 1);assert.equal(result.pages, 4);assert.equal(result.title, 'كتاب التجربة');
  const meta = db.prepare('SELECT b.bk, b.cat, a.auth FROM books_meta b LEFT JOIN authors a ON a.authid=b.authno WHERE bkid=?').get(result.bkid);
  assert.deepEqual(meta, { bk: 'كتاب التجربة', cat: category, auth: 'مؤلف تجريبي جديد' });
  assert.equal(db.prepare('SELECT count(*) AS n FROM pages WHERE book_id=?').get(result.bkid).n, 4);
  assert.deepEqual(db.prepare('SELECT id,lvl,tit FROM titles WHERE book_id=? ORDER BY id').all(result.bkid).map(r => r.tit), ['المقدمة', 'باب الطهارة', 'فصل في المياه']);
  assert.ok(db.prepare("SELECT p.book_id FROM pages_fts f JOIN pages p ON p.rowid=f.rowid WHERE pages_fts MATCH 'طهور' AND p.book_id=?").get(result.bkid), 'searchable');
  assert.ok(fs.existsSync(path.join(directory, 'book-import-backups', result.backup)));

  // A second import reuses the same author instead of duplicating it.
  const again = await (await post('import', { data, title: 'نسخة ثانية', author: 'مؤلف تجريبي جديد', categoryId: category })).json();
  assert.equal(db.prepare("SELECT count(*) AS n FROM authors WHERE auth='مؤلف تجريبي جديد'").get().n, 1);
  assert.equal(again.bkid, result.bkid + 1);
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
});
