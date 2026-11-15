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
  { test: /(?:^|\s)من\s+(?:هو|هي|كان)(?:\s|$)|ترجم|سيرة|شيوخ|تلاميذ|\bsiapa\b|biografi|riwayat hidup|\bguru\b|\bmurid\b|\blahir\b|\bwafat\b/iu, words: ['ولد', 'توفي', 'ترجمة', 'اسمه', 'نسبه', 'مولده', 'وفاته', 'شيوخه', 'تلاميذه'] },
  { test: /شيوخ|أساتذ|\bguru\b|berguru/iu, words: ['شيوخه', 'تفقه', 'أخذ عن', 'سمع من'] },
  { test: /فضل|فضائل|ثواب|keutamaan|fadh?ilah|pahala/iu, words: ['فضل', 'فضائل', 'ثواب', 'أجر'] },
  { test: /شروط|شرط|\bsyarat/iu, words: ['شروط', 'شرط', 'يشترط'] },
  { test: /كيفية|صفة|\bcara\b/iu, words: ['كيفية', 'صفة'] },
];
// Well-known imams: a nisba such as الشافعي also names thousands of later scholars of the madhhab,
// so biography questions first look for the full name next to the nisba.
const PEOPLE = [
  { test: /الشافعي|\b(?:asy[-\s]?)?s[yh]afi['’\u02bc]?i[iy]?\b|\bshafi['’\u02bc]?i\b/iu, match: 'NEAR("محمد بن إدريس" "الشافعي", 5)', words: ['محمد بن إدريس', 'الشافعي'] },
  { test: /[أا]ب[وي] حنيفة|\babu\s+hanifa?h?\b/iu, match: 'NEAR("النعمان بن ثابت" "حنيفة", 8)', words: ['النعمان بن ثابت', 'حنيفة'] },
  { test: /مالك بن [أا]نس|الإمام مالك|\bimam\s+malik\b/iu, match: '"مالك بن أنس"', words: ['مالك بن أنس'] },
  { test: /ابن حنبل|بن حنبل|الإمام [أا]حمد|\bimam\s+ahmad\b|\bahmad\s+bin\s+hanbal\b/iu, match: '("أحمد بن حنبل" OR "أحمد بن محمد بن حنبل")', words: ['أحمد بن حنبل', 'أحمد بن محمد بن حنبل'] },
  { test: /البخاري|\bbukhari\b/iu, match: 'NEAR("محمد بن إسماعيل" "البخاري", 5)', words: ['محمد بن إسماعيل', 'البخاري'] },
  { test: /مسلم بن الحجاج|الإمام مسلم|\bimam\s+muslim\b/iu, match: '"مسلم بن الحجاج"', words: ['مسلم بن الحجاج'] },
  { test: /النووي|\bnawawi\b/iu, match: 'NEAR("يحيى بن شرف" "النووي", 6)', words: ['يحيى بن شرف', 'النووي'] },
  { test: /الغزالي|\bghazal[iy]\b/iu, match: '("أبو حامد الغزالي" OR NEAR("محمد بن محمد" "الغزالي", 6))', words: ['أبو حامد', 'الغزالي'] },
];
export const namedPeople = (...texts) => PEOPLE.filter(p => texts.some(t => p.test.test(String(t || ''))));
const BIOGRAPHY = ASPECTS[1];
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

const positions = (plain, words) => {
  const hits = [];
  for (const word of words) for (let i = plain.indexOf(word); i >= 0 && hits.length < 400; i = plain.indexOf(word, i + word.length)) hits.push(i);
  return hits.sort((a, b) => a - b);
};
/**
 * Densest ~1.4k-character window of the page around the query words, cut at line/word boundaries.
 * With anchors (a named person's full name), the window starts at an anchor so a page with several
 * biographies shows the asked person, not a neighbour's entry.
 */
export function pagePassage(text, words, size = AI_PASSAGE_LENGTH, anchors = []) {
  const plain = clean(text);
  if (plain.length <= size) return plain;
  const hits = positions(plain, words), starts = positions(plain, anchors);
  const count = from => { let n = 0; for (const h of hits) if (h >= from && h < from + size - 200) n++; return n; };
  let best = 0, bestCount = -1;
  for (const start of starts.length ? starts : hits) { const n = count(start); if (n > bestCount) { bestCount = n; best = start; } }
  let start = Math.max(0, best - (starts.length ? 120 : 200));
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
    next: db.prepare(`SELECT b.bkid,b.bk AS title,p.id AS pageId,p.part AS juz,p.page,p.nass FROM ${schema}.pages p JOIN ${schema}.books_meta b ON b.bkid=p.book_id WHERE p.book_id=? AND p.id>? ORDER BY p.id LIMIT 1`),
  }]));
  const biography = !catalogue && [question, focusQuestion].some(t => BIOGRAPHY.test.test(String(t || '')));
  const people = biography ? namedPeople(question, focusQuestion) : [];
  const densityWords = [...terms, ...aspects, ...people.flatMap(p => p.words)];
  const anchors = people.map(p => p.words[0]);
  const anchorPattern = anchors.length ? new RegExp(anchors.map(a => a.replace(/[أإآا]/g, '[أإآا]')).join('|'), 'u') : null;
  // Excerpts are passages of the stored page text (no FTS snippet), so verifiedReferences can match them exactly.
  const search = (match, { requireAnchor = false } = {}) => {
    const found = [];
    for (const schema of schemas) {
      const { rank, detail, next } = statements[schema];
      for (const { rowid, score } of rank.all(match)) {
        const row = detail.get(rowid);
        if (!row) continue;
        const text = sourceText(row.nass), quality = pageQuality(text);
        if (!quality.usable) continue;
        // About a named imam, a page without his full name is usually a namesake's or another imam's entry.
        if (requireAnchor && !anchorPattern.test(clean(text))) continue;
        const excerpt = pagePassage(text, densityWords, AI_PASSAGE_LENGTH, anchors);
        if (!matchesQuestionTopic(excerpt, focusQuestion)) continue;
        const { nass: _nass, ...page } = row;
        found.push({ ...page, excerpt, score: score * quality.factor });
        // A section heading at the very end of a page ("شيوخه:") continues on the next page: add its start right after.
        const plain = clean(text), last = Math.max(-1, ...aspects.map(word => plain.lastIndexOf(word)));
        if (last < 0 || plain.length - last > 40) continue;
        const following = next.get(row.bkid, row.pageId);
        if (!following) continue;
        const followingText = sourceText(following.nass);
        if (!pageQuality(followingText).usable) continue;
        const start = pagePassage(followingText, [], AI_PASSAGE_LENGTH);
        if (!matchesQuestionTopic(start, focusQuestion)) continue;
        const { nass: _next, ...followingPage } = following;
        found.push({ ...followingPage, excerpt: start, score: score * quality.factor, continuation: true });
      }
    }
    // Stable sort keeps a continuation page directly after the page it continues.
    return found.sort((a, b) => a.score - b.score);
  };
  const base = join => '(' + quoted(terms).join(join) + ')' + (constraint ? ' AND ' + constraint : '');
  const passes = [];
  // Biography of a named imam: full name + nisba near a biography word, ahead of the generic passes.
  if (people.length) passes.push(search('(' + people.map(p => p.match).join(' OR ') + ') AND (' + quoted(aspects).join(' OR ') + ')' + (constraint ? ' AND ' + constraint : '')));
  // Once the imam's own entries are found, generic passes keep only pages that name him in full.
  const requireAnchor = passes.length > 0 && passes[0].length > 0;
  // NEAR keeps the aspect word next to the topic (حكم صلاة الجماعة), not anywhere on a long page.
  if (aspects.length) passes.push(search('(' + aspects.map(word => `NEAR(${quoted([...terms, word]).join(' ')}, 10)`).join(' OR ') + ')' + (constraint ? ' AND ' + constraint : ''), { requireAnchor }));
  let pages = search(base(' AND '), { requireAnchor });
  if (!pages.length && terms.length > 1) pages = search(base(' OR '), { requireAnchor });
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
