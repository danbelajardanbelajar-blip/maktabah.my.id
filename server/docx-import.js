import zlib from 'node:zlib';

// Turns a Word (.docx) file into a Maktabah book: pages of plain text (lines separated by \r, like the
// existing library) and a table of contents built from Word headings. Only node:zlib is used, so no new
// dependency has to be installed on the server.

export const WORD_LIMITS = {fileBytes:25 * 1024 * 1024, entryBytes:80 * 1024 * 1024, pageChars:4000, pages:20000, textChars:40 * 1024 * 1024, title:300, author:200};
export const SPLIT_MODES = ['heading', 'word'];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };

// --- ZIP (a .docx is a ZIP of XML parts) -------------------------------------------------------------

export function readZip(buffer, wanted) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) fail('File bukan dokumen Word (.docx) yang valid.');
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) fail('Struktur file .docx rusak (direktori ZIP tidak ditemukan).');
  const count = buffer.readUInt16LE(eocd + 10), dirOffset = buffer.readUInt32LE(eocd + 16);
  if (dirOffset === 0xffffffff || count === 0xffff) fail('File .docx terlalu besar (ZIP64 tidak didukung).');
  const out = new Map();
  let p = dirOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50) fail('Struktur file .docx rusak.');
    const method = buffer.readUInt16LE(p + 10), compressed = buffer.readUInt32LE(p + 20), size = buffer.readUInt32LE(p + 24);
    const nameLength = buffer.readUInt16LE(p + 28), extraLength = buffer.readUInt16LE(p + 30), commentLength = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;
    if (!wanted.has(name)) continue;
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) fail('Struktur file .docx rusak.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > buffer.length) fail('File .docx terpotong.');
    if (size > WORD_LIMITS.entryBytes) fail('Isi dokumen Word terlalu besar.', 413);
    const raw = buffer.subarray(start, start + compressed);
    let data;
    try {
      if (method === 0) data = Buffer.from(raw);
      else if (method === 8) data = zlib.inflateRawSync(raw, {maxOutputLength:WORD_LIMITS.entryBytes});
      else fail('Metode kompresi .docx tidak didukung.');
    } catch (error) { if (error.status) throw error; fail('Isi file .docx tidak dapat dibuka.'); }
    out.set(name, data.toString('utf8'));
  }
  return out;
}

// --- XML ---------------------------------------------------------------------------------------------

const ENTITIES = {lt:'<', gt:'>', amp:'&', quot:'"', apos:"'"};
export const decodeXml = text => text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()];
  const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
});
const attr = (tag, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag); return m ? decodeXml(m[1]) : null; };
const truthy = tag => !/\bw:val="(0|false|off)"/.test(tag);

// Content that must not reach the text: deleted revisions, field codes, and the duplicate fallback copy
// Word stores for drawing/textbox content.
const SKIP = new Set(['w:del', 'w:delText', 'w:instrText', 'mc:Fallback', 'w:fldData']);
export const PAGE_BREAK = '\f', RENDERED_BREAK = '\v';
const NOTE_OPEN = '\u0001', NOTE_CLOSE = '\u0002';

// Paragraphs in document order: {text, style, outline, pageBreakBefore, note}.
export function parseParagraphs(xml) {
  const paragraphs = [], stack = [];
  let skip = 0, inText = false, inPPr = false, note = null;
  const re = /<([^>]+)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[2] !== undefined) { if (inText && !skip && stack.length) stack[stack.length - 1].text += decodeXml(m[2]); continue; }
    const tag = m[1];
    if (tag[0] === '?' || tag[0] === '!') continue;
    const closing = tag[0] === '/', selfClosing = tag.endsWith('/');
    const name = (closing ? tag.slice(1) : tag).split(/[\s/]/)[0];
    if (SKIP.has(name)) { if (!selfClosing) skip += closing ? -1 : 1; continue; }
    if (skip > 0) continue;
    const current = stack[stack.length - 1];
    switch (name) {
      case 'w:footnote': case 'w:endnote':
        if (closing) note = null;
        else if (!selfClosing && !/w:type="(separator|continuationSeparator|continuationNotice)"/.test(tag)) note = `${name === 'w:footnote' ? 'f' : 'e'}${attr(tag, 'w:id')}`;
        else if (!selfClosing) note = '';
        break;
      case 'w:p':
        if (selfClosing) paragraphs.push({text:'', style:null, outline:null, pageBreakBefore:false, note});
        else if (!closing) stack.push({text:'', style:null, outline:null, pageBreakBefore:false, note});
        else if (stack.length) paragraphs.push(stack.pop());
        break;
      case 'w:pPr': inPPr = !closing && !selfClosing; break;
      case 'w:pStyle': if (inPPr && current && !closing) current.style = attr(tag, 'w:val'); break;
      case 'w:outlineLvl': if (inPPr && current && !closing) current.outline = Number(attr(tag, 'w:val')); break;
      case 'w:pageBreakBefore': if (inPPr && current && !closing && truthy(tag)) current.pageBreakBefore = true; break;
      case 'w:t': inText = !closing && !selfClosing; break;
      case 'w:tab': case 'w:ptab': if (current && !closing && !inPPr) current.text += '\t'; break;
      case 'w:noBreakHyphen': if (current && !closing) current.text += '-'; break;
      case 'w:cr': if (current && !closing) current.text += '\r'; break;
      case 'w:br':
        if (current && !closing) current.text += attr(tag, 'w:type') === 'page' ? PAGE_BREAK : attr(tag, 'w:type') === 'column' ? '' : '\r';
        break;
      case 'w:lastRenderedPageBreak': if (current && !closing) current.text += RENDERED_BREAK; break;
      case 'w:footnoteReference': case 'w:endnoteReference':
        if (current && !closing) current.text += `${NOTE_OPEN}${name === 'w:footnoteReference' ? 'f' : 'e'}${attr(tag, 'w:id')}${NOTE_CLOSE}`;
        break;
      case 'w:tc': if (closing && current) current.text += '\t'; break;
    }
  }
  return paragraphs;
}

// styleId -> {level (1-9 or 0), title}
export function parseStyles(xml = '') {
  const raw = new Map();
  for (const block of xml.match(/<w:style\b[\s\S]*?<\/w:style>/g) || []) {
    const id = attr(block.slice(0, block.indexOf('>') + 1), 'w:styleId');
    if (!id) continue;
    const name = (/<w:name w:val="([^"]*)"/.exec(block)?.[1] || '').toLowerCase();
    const outline = /<w:outlineLvl w:val="(\d+)"/.exec(block)?.[1];
    raw.set(id, {name, outline:outline == null ? null : Number(outline), basedOn:/<w:basedOn w:val="([^"]*)"/.exec(block)?.[1] || null});
  }
  const resolve = (id, depth = 0) => {
    const s = raw.get(id);
    if (!s || depth > 8) return {level:0, title:false};
    const heading = /^heading (\d)$/.exec(s.name);
    if (heading) return {level:Number(heading[1]), title:false};
    if (s.name === 'title') return {level:1, title:true};
    if (s.outline != null) return {level:s.outline < 9 ? s.outline + 1 : 0, title:false};
    return s.basedOn ? resolve(s.basedOn, depth + 1) : {level:0, title:false};
  };
  const styles = new Map();
  for (const id of raw.keys()) styles.set(id, resolve(id));
  return styles;
}

// Control characters are matched on purpose: \f, \v and \u0001/\u0002 are the internal page/footnote markers.
// eslint-disable-next-line no-control-regex
const clean = text => text.normalize('NFC').replace(/[\u0000\u0003-\u0008\u000e-\u001f\u007f]/g, '').replace(/ /g, ' ');
const plain = text => clean(text).replace(new RegExp(`[${PAGE_BREAK}${RENDERED_BREAK}]|${NOTE_OPEN}[^${NOTE_CLOSE}]*${NOTE_CLOSE}`, 'g'), '').replace(/[\t\r]+/g, ' ').replace(/\s+/g, ' ').trim();

export function parseDocx(buffer) {
  if (buffer.length > WORD_LIMITS.fileBytes) fail(`File Word maksimal ${WORD_LIMITS.fileBytes / 1024 / 1024} MB.`, 413);
  const parts = readZip(buffer, new Set(['word/document.xml', 'word/styles.xml', 'word/footnotes.xml', 'word/endnotes.xml', 'docProps/core.xml']));
  const document = parts.get('word/document.xml');
  if (!document) fail('Dokumen Word tidak berisi teks (word/document.xml tidak ada). Pastikan file berformat .docx, bukan .doc lama.');
  const styles = parseStyles(parts.get('word/styles.xml'));
  const notes = new Map();
  for (const part of ['word/footnotes.xml', 'word/endnotes.xml']) {
    for (const p of parts.has(part) ? parseParagraphs(parts.get(part)) : []) {
      if (!p.note) continue;
      const text = plain(p.text);
      if (text) notes.set(p.note, notes.has(p.note) ? `${notes.get(p.note)} ${text}` : text);
    }
  }
  const paragraphs = parseParagraphs(document).map(p => {
    const style = p.style ? styles.get(p.style) : null;
    const level = Number.isInteger(p.outline) && p.outline < 9 ? p.outline + 1 : style?.level || 0;
    return {text:clean(p.text), level:Math.min(level, 6), title:Boolean(style?.title), pageBreakBefore:p.pageBreakBefore};
  });
  const core = parts.get('docProps/core.xml') || '';
  const coreTitle = decodeXml(/<dc:title>([^<]*)<\/dc:title>/.exec(core)?.[1] || '').trim();
  return {paragraphs, notes, coreTitle};
}

// --- Pages and table of contents ---------------------------------------------------------------------

const splitLong = (text, max) => {
  const pieces = [];
  let rest = text;
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf('۔ ', max), rest.lastIndexOf('؟ ', max), rest.lastIndexOf('! ', max));
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max - 1;
    pieces.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) pieces.push(rest.trim());
  return pieces;
};

export function buildBook(parsed, {split = 'heading', fileName = ''} = {}) {
  if (!SPLIT_MODES.includes(split)) fail('Cara pembagian halaman tidak valid.');
  const pages = [], titles = [], warnings = [];
  let lines = [], pageNotes = [], pageTitle = null, chars = 0, total = 0;
  const flush = () => {
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length && !pageTitle) { pageNotes = []; return; }
    if (pages.length >= WORD_LIMITS.pages) fail(`Dokumen menghasilkan lebih dari ${WORD_LIMITS.pages.toLocaleString('id-ID')} halaman.`, 413);
    const id = pages.length + 1;
    let nass = lines.join('\r').replace(/\r{3,}/g, '\r\r');
    if (pageNotes.length) nass += `\r__________\r${pageNotes.map((n, i) => `(${i + 1}) ${n}`).join('\r')}`;
    total += nass.length;
    if (total > WORD_LIMITS.textChars) fail('Isi dokumen Word terlalu besar.', 413);
    pages.push({id, part:1, page:id, nass});
    if (pageTitle) titles.push({id, lvl:pageTitle.lvl, sub:0, tit:pageTitle.tit});
    lines = []; pageNotes = []; pageTitle = null; chars = 0;
  };
  // Footnote markers become (1), (2)… numbered per page, with the note text under a separator line.
  const resolveNotes = text => text.replace(new RegExp(`${NOTE_OPEN}([^${NOTE_CLOSE}]*)${NOTE_CLOSE}`, 'g'), (m, key) => {
    const note = parsed.notes.get(key);
    if (!note) return '';
    pageNotes.push(note);
    return `(${pageNotes.length})`;
  });
  const addLine = text => {
    if (chars + text.length > WORD_LIMITS.pageChars && chars > 0) flush();
    for (const piece of text.length > WORD_LIMITS.pageChars ? splitLong(text, WORD_LIMITS.pageChars) : [text]) {
      if (chars > 0 && chars + piece.length > WORD_LIMITS.pageChars) flush();
      lines.push(resolveNotes(piece));
      chars += piece.length + 1;
    }
  };

  let headings = 0;
  for (const p of parsed.paragraphs) {
    if (p.pageBreakBefore) flush();
    const breaks = new RegExp(split === 'word' ? `[${PAGE_BREAK}${RENDERED_BREAK}]` : PAGE_BREAK);
    const segments = p.text.replace(split === 'word' ? /(?!)/ : new RegExp(RENDERED_BREAK, 'g'), '').split(breaks);
    let headingPending = p.level > 0;
    segments.forEach((segment, index) => {
      if (index > 0) flush();
      const text = segment.replace(/[ \t]+$/gm, '');
      if (headingPending && plain(text)) {
        headingPending = false;
        // Each heading opens a page: the library stores one table-of-contents entry per page.
        flush();
        pageTitle = {lvl:p.level, tit:plain(text).slice(0, 500)};
        headings++;
      }
      for (const line of text.split('\r')) addLine(line);
    });
  }
  flush();
  if (!pages.length) fail('Dokumen Word tidak berisi teks yang dapat diimport.');
  if (!headings) warnings.push('Tidak ada judul (style Heading) di dokumen, jadi daftar isi kosong. Gunakan style Heading 1/2/3 di Word agar daftar isi terbentuk.');
  if (split === 'word' && !parsed.paragraphs.some(p => p.text.includes(RENDERED_BREAK))) warnings.push('File ini tidak menyimpan posisi halaman Word, jadi halaman dibagi per judul dan per ±4.000 karakter.');
  const titleParagraph = parsed.paragraphs.find(p => p.title && plain(p.text));
  const guessedTitle = (parsed.coreTitle || (titleParagraph && plain(titleParagraph.text)) || titles[0]?.tit || fileName.replace(/\.docx$/i, '')).slice(0, WORD_LIMITS.title);
  return {pages, titles, warnings, guessedTitle, footnotes:parsed.notes.size};
}

export function wordToBook(buffer, options) { return buildBook(parseDocx(buffer), options); }

export function decodeUpload(data) {
  if (typeof data !== 'string' || !data) fail('Pilih file Word (.docx).');
  const base64 = data.slice(data.indexOf(',') + 1);
  if (base64.length > Math.ceil(WORD_LIMITS.fileBytes * 4 / 3) + 8) fail(`File Word maksimal ${WORD_LIMITS.fileBytes / 1024 / 1024} MB.`, 413);
  return Buffer.from(base64, 'base64');
}
