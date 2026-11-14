import {Worker} from 'node:worker_threads';
import {matchesQuestionTopic,topicSearchConstraint} from './ai-relevance.js';
import {sourceText} from './ai-source.js';

// Ranking only rowids first keeps page work to the top candidates; computing snippets for every
// match of a common word (hundreds of thousands of pages) blocked the server for more than a minute.
export const AI_CANDIDATE_LIMIT = 60;
export const AI_RETRIEVAL_TIMEOUT = 20000;
export const AI_PASSAGE_LENGTH = 1400;
const clean = text => String(text ?? '').replace(/<[^>]*>/g, '').replace(/[ً-ٰٟ]/g, '').trim();
const ignored = new Set('apa apakah siapa bagaimana kapan mengapa kenapa dimana berapa jelaskan tolong tentang menurut referensi kitab tersedia dalam dari untuk yang dan dengan hukum saya ini itu ada what how the is of in من ما هل عن في على إلى هو هي هذا هذه حكم'.split(' '));
export const searchTerms = text => [...new Set(clean(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !ignored.has(w)))].slice(0, 8);
const fault = (message, code, status) => Object.assign(new Error(message), { code, status });
export const searchTimeout = () => fault('Pencarian rujukan untuk pertanyaan ini terlalu luas sehingga memerlukan waktu lebih lama. Tambahkan kata kunci yang lebih spesifik, misalnya judul kitab, bab, atau mazhab, lalu coba lagi.', 'AI_SEARCH_TIMEOUT', 504);
const searchUnavailable = () => fault('Pencarian rujukan kitab belum dapat diselesaikan. Silakan coba lagi.', 'AI_SEARCH_UNAVAILABLE', 503);

// Aspect words steer ranking toward pages that answer the asked aspect (ruling, biography, merit…).
// They only order candidates: a pass without them always follows, so no topic is lost.
const ASPECTS = [
  { test: /حكم|يجوز|يحرم|\bhukum|\bbolehkah|\bhalal\b|\bharam\b|\bwajib/iu, words: ['حكم', 'يجب', 'واجب', 'فرض', 'سنة', 'مستحب', 'يجوز', 'يحرم', 'مكروه'] },
  { test: /(?:^|\s)من\s+(?:هو|هي|كان)(?:\s|$)|ترجم|سيرة|\bsiapa\b|biografi|riwayat hidup/iu, words: ['ولد', 'توفي', 'ترجمة', 'اسمه', 'نسبه', 'مولده', 'وفاته', 'شيوخه', 'تلاميذه'] },
  { test: /فضل|فضائل|ثواب|keutamaan|fadh?ilah|pahala/iu, words: ['فضل', 'فضائل', 'ثواب', 'أجر'] },
  { test: /شروط|شرط|\bsyarat/iu, words: ['شروط', 'شرط', 'يشترط'] },
  { test: /كيفية|صفة|\bcara\b/iu, words: ['كيفية', 'صفة'] },
];
export const aspectWords = (...texts) => [...new Set(ASPECTS.filter(a => texts.some(t => a.test.test(String(t || '')))).flatMap(a => a.words))];

/** Table-of-contents, index and broken-encoding pages rank well on bm25 but rarely answer anything. */
export function pageQuality(text) {
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < 10) return { usable: false, reason: 'empty' };
  // Arabic text uses ؟; many ASCII "?" or U+FFFD mark characters lost in OCR/encoding conversion.
  const broken = (text.match(/[?�]/g) || []).length;
  if (broken > 15) return { usable: false, reason: 'encoding' };
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const leaders = (text.match(/(?:\.\s*){3,}|…/g) || []).length;
  const numbered = lines.filter(l => l.length < 90 && (/^[([]?[\d٠-٩]+\s*[-.)\]]/u.test(l) || /[\d٠-٩]+\s*$/u.test(l))).length;
  const toc = leaders >= 4 || (lines.length >= 6 && numbered / lines.length >= 0.4);
  // Short pages (one hadith, a heading) stay usable but rank below fuller discussions.
  return { usable: true, toc, factor: (toc ? 0.25 : 1) * (letters < 200 ? 0.7 : 1) };
}

/** Densest ~1.4k-character window of the page around the query words, cut at line/word boundaries. */
export function pagePassage(text, words, size = AI_PASSAGE_LENGTH) {
  const plain = clean(text);
  if (plain.length <= size) return plain;
  const hits = [];
  for (const word of words) for (let i = plain.indexOf(word); i >= 0 && hits.length < 400; i = plain.indexOf(word, i + word.length)) hits.push(i);
  hits.sort((a, b) => a - b);
  let best = 0, bestCount = 0;
  for (let i = 0, j = 0; i < hits.length; i++) {
    while (j < hits.length && hits[j] < hits[i] + size - 200) j++;
    if (j - i > bestCount) { bestCount = j - i; best = hits[i]; }
  }
  let start = Math.max(0, best - 200);
  const lineStart = plain.lastIndexOf('\n', start + 150);
  if (lineStart >= 0 && lineStart >= start - 200) start = lineStart + 1;
  else if (start > 0) { const space = plain.indexOf(' ', start); if (space >= 0 && space < start + 40) start = space + 1; }
  let end = Math.min(plain.length, start + size);
  if (end < plain.length) { const space = Math.max(plain.lastIndexOf(' ', end), plain.lastIndexOf('\n', end)); if (space > start + size / 2) end = space; }
  return plain.slice(start, end).trim();
}

/** Candidate pool for one question: ranked pages (and catalogue books), without policy exclusions applied. */
export function retrieveAiCandidates(db, question, additional = false, catalogue = false, focusQuestion = question) {
  const terms = searchTerms(question);
  if (!terms.length) return [];
  const constraint = catalogue ? '' : topicSearchConstraint(focusQuestion);
  const aspects = catalogue ? [] : aspectWords(question, focusQuestion);
  const quoted = words => words.map(t => `"${t}"`);
  const schemas = (additional ? ['main', 'tambahan'] : ['main']).filter(schema => db.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE name='pages_fts' AND type='table'`).get());
  const statements = Object.fromEntries(schemas.map(schema => [schema, {
    rank: db.prepare(`SELECT rowid,bm25(pages_fts) AS score FROM ${schema}.pages_fts WHERE pages_fts MATCH ? ORDER BY bm25(pages_fts) LIMIT ${AI_CANDIDATE_LIMIT}`),
    detail: db.prepare(`SELECT b.bkid,b.bk AS title,p.id AS pageId,p.part AS juz,p.page,p.nass FROM ${schema}.pages p JOIN ${schema}.books_meta b ON b.bkid=p.book_id WHERE p.rowid=?`),
  }]));
  const densityWords = [...terms, ...aspects];
  // Excerpts are passages of the stored page text (no FTS snippet), so verifiedReferences can match them exactly.
  const search = match => {
    const found = [];
    for (const schema of schemas) {
      const { rank, detail } = statements[schema];
      for (const { rowid, score } of rank.all(match)) {
        const row = detail.get(rowid);
        if (!row) continue;
        const text = sourceText(row.nass), quality = pageQuality(text);
        if (!quality.usable) continue;
        const excerpt = pagePassage(text, densityWords);
        if (!matchesQuestionTopic(excerpt, focusQuestion)) continue;
        const { nass: _nass, ...page } = row;
        found.push({ ...page, excerpt, score: score * quality.factor });
      }
    }
    return found.sort((a, b) => a.score - b.score);
  };
  const base = join => '(' + quoted(terms).join(join) + ')' + (constraint ? ' AND ' + constraint : '');
  const passes = [];
  // NEAR keeps the aspect word next to the topic (حكم صلاة الجماعة), not anywhere on a long page.
  if (aspects.length) passes.push(search('(' + aspects.map(word => `NEAR(${quoted([...terms, word]).join(' ')}, 10)`).join(' OR ') + ')' + (constraint ? ' AND ' + constraint : '')));
  let pages = search(base(' AND '));
  if (!pages.length && terms.length > 1) pages = search(base(' OR '));
  passes.push(pages);
  const seen = new Set();
  const ranked = passes.flat().filter(r => { const id = `${r.bkid}:${r.pageId}`; if (seen.has(id)) return false; seen.add(id); return true; });
  const books = [];
  if (catalogue) {
    for (const schema of additional ? ['main', 'tambahan'] : ['main']) {
      const rows = db.prepare(`SELECT bkid,bk AS title FROM ${schema}.books_meta WHERE (${terms.map(() => 'bk LIKE ?').join(' OR ')}) LIMIT 20`).all(...terms.map(t => `%${t}%`));
      books.push(...rows.map(r => ({ ...r, pageId: null, juz: null, page: null, excerpt: `Informasi katalog: kitab berjudul "${clean(r.title)}" tersedia di perpustakaan. Metadata ini hanya memastikan keberadaan kitab, bukan kutipan isi atau dasar hukum.` })));
    }
  }
  return [...books, ...ranked.map(({ score: _score, ...r }) => r)];
}

/** Picks at most 8 references from a candidate pool, skipping excluded books and keeping ≤3 pages per book. */
export function selectAiReferences(candidates, catalogue = false, excludedBooks = []) {
  const excluded = new Set(excludedBooks);
  const seen = new Set(), perBook = new Map();
  const pages = candidates.filter(r => r.pageId != null && !excluded.has(r.bkid)).filter(r => {
    const id = `${r.bkid}:${r.pageId}`;
    if (seen.has(id) || (perBook.get(r.bkid) || 0) >= 3) return false;
    seen.add(id); perBook.set(r.bkid, (perBook.get(r.bkid) || 0) + 1); return true;
  }).slice(0, 8);
  if (!catalogue) return pages;
  const books = candidates.filter(r => r.pageId == null && !excluded.has(r.bkid)).slice(0, 5);
  return [...books, ...pages].filter((r, i, all) => all.findIndex(x => x.bkid === r.bkid && x.pageId === r.pageId) === i).slice(0, 8);
}

export function retrieveAiReferences(db, question, additional = false, catalogue = false, focusQuestion = question, excludedBooks = []) {
  return selectAiReferences(retrieveAiCandidates(db, question, additional, catalogue, focusQuestion), catalogue, excludedBooks);
}

/**
 * Runs retrieval for file-backed libraries in a read-only worker so the HTTP server keeps streaming
 * progress and serving other visitors. In-memory databases (tests) are searched in-process.
 */
export function retrieveAiCandidatesOffThread(db, [question, additional = false, catalogue = false, focusQuestion = question], { signal, timeout = AI_RETRIEVAL_TIMEOUT } = {}) {
  const list = db.pragma('database_list');
  const main = list.find(row => row.name === 'main')?.file;
  const tambahan = additional ? list.find(row => row.name === 'tambahan')?.file : null;
  if (!main || (additional && !tambahan)) return Promise.resolve(retrieveAiCandidates(db, question, additional, catalogue, focusQuestion));
  return new Promise((resolve, reject) => {
    let worker, timer, settled = false;
    const cancel = () => finish(fault('Permintaan dibatalkan.', 'CANCELLED', 499));
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (worker) void worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    try {
      if (signal?.aborted) return cancel();
      if (timeout <= 0) return finish(searchTimeout());
      worker = new Worker(new URL('./ai-retrieval-worker.js', import.meta.url), { workerData: { main, tambahan, args: [question, additional, catalogue, focusQuestion] } });
      worker.once('message', message => finish(message.error ? searchUnavailable() : null, message.candidates));
      worker.once('error', () => finish(searchUnavailable()));
      worker.once('exit', () => finish(searchUnavailable()));
      timer = setTimeout(() => finish(searchTimeout()), timeout);
      signal?.addEventListener('abort', cancel, { once: true });
    } catch { finish(searchUnavailable()); }
  });
}
