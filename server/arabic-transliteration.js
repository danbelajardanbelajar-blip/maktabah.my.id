const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const NON_ARABIC_WORD_RE = /[^\u0621-\u064A]+/g;
const LATIN_LETTER_RE = /[a-zA-Z]/;

const ARABIC_CONSONANT_MAP = {
  ب: 'b',
  ت: 't',
  ط: 't',
  ث: 's',
  س: 's',
  ص: 's',
  ج: 'j',
  ح: 'h',
  ه: 'h',
  ة: 'h',
  خ: 'kh',
  د: 'd',
  ض: 'd',
  ذ: 'z',
  ز: 'z',
  ظ: 'z',
  ر: 'r',
  ش: 'sy',
  غ: 'g',
  ف: 'f',
  ق: 'k',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
};

// Popular Indonesian/English transliteration aliases that differ from literal Arabic tokens
export const POPULAR_BOOK_ALIASES = [
  { pattern: /\b(arbain|arba'?in)(\s+nawawi)?\b/i, arabicTerms: ['الأربعين النووية', 'الأربعون النووية'] },
  { pattern: /\b(jurumiyah|jurumiyyah|ajurumiyah|ajrumiyyah)\b/i, arabicTerms: ['الآجرومية', 'الأجرومية'] },
  { pattern: /\bsafinatun\s*najah\b|\bsafinah\b/i, arabicTerms: ['سفينة النجاة'] },
  { pattern: /\bfathul\s*(qorib|qarib)\b/i, arabicTerms: ['فتح القريب'] },
  { pattern: /\bfathul\s*mu'?in\b/i, arabicTerms: ['فتح المعين'] },
  { pattern: /\bihya(\s+ulum[ui]dd?in)?\b/i, arabicTerms: ['إحياء علوم الدين'] },
  { pattern: /\bibnu\s*kats?ir\b/i, arabicTerms: ['ابن كثير'] },
  { pattern: /\bjalalain\b/i, arabicTerms: ['الجلالين'] },
  { pattern: /\btaqrib\b/i, arabicTerms: ['التقريب'] },
];

function collapseRepeats(str) {
  return str.replace(/(.)\1+/g, '$1');
}

export function arabicWordToSkeleton(word) {
  let clean = String(word || '').replace(ARABIC_DIACRITICS_RE, '').trim();
  if (!clean) return '';
  if (clean.length > 3 && clean.startsWith('ال')) {
    clean = clean.slice(2);
  }
  let out = '';
  for (const ch of clean) {
    if (ARABIC_CONSONANT_MAP[ch]) {
      out += ARABIC_CONSONANT_MAP[ch];
    }
  }
  return collapseRepeats(out);
}

export function arabicTextToTokens(text) {
  const cleaned = String(text || '')
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(NON_ARABIC_WORD_RE, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s+/)
    .map(arabicWordToSkeleton)
    .filter((t) => t.length >= 2);
}

export function latinWordToSkeleton(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';

  // Strip common Arabic definite article prefixes in Indonesian/English transliteration
  w = w.replace(/^(al|ul|el|il|ud|ad|id|as|us|ar|ur|at|ut|an|un|az|uz)/, (m) => (w.length - m.length >= 2 ? '' : m));

  // Strip common genitive/construct suffixes (-ul, -il, -al, -us) at word end if stem remains >= 2 chars
  w = w.replace(/(ul|il|al|us)$/, (m) => (w.length - m.length >= 2 ? '' : m));

  // Normalize Indonesian/English Arabic digraphs before stripping vowels
  w = w
    .replace(/sh/g, 's')
    .replace(/ts/g, 's')
    .replace(/dh/g, 'd')
    .replace(/dz/g, 'z')
    .replace(/ch/g, 'kh')
    .replace(/gh/g, 'g')
    .replace(/q/g, 'k')
    .replace(/c/g, 'k')
    .replace(/p/g, 'f')
    .replace(/v/g, 'f');

  // Remove vowels and weak semi-vowels (w, y) to match Arabic consonant skeletons
  w = w.replace(/[aeiouwy]/g, '');
  return collapseRepeats(w);
}

export function latinTextToTokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[\s\-_.'’`]+/)
    .map(latinWordToSkeleton)
    .filter((t) => t.length >= 2);
}

export function containsLatin(text) {
  return LATIN_LETTER_RE.test(String(text || ''));
}

export function buildBookTranslitIndex(db, { hasAdditional = () => false } = {}) {
  if (!db) return [];
  const schemas = hasAdditional() ? ['main', 'tambahan'] : ['main'];
  const index = [];
  const seen = new Set();

  for (const schema of schemas) {
    try {
      const rows = db.prepare(`
        SELECT b.bkid, b.bk, c.name AS cat_name
        FROM ${schema}.books_meta b
        LEFT JOIN ${schema}.categories c ON b.cat = c.id
      `).all();
      for (const r of rows) {
        if (seen.has(r.bkid)) continue;
        seen.add(r.bkid);
        const title = String(r.bk || '').trim();
        if (!title) continue;
        const tokens = arabicTextToTokens(title);
        const joined = collapseRepeats(tokens.join(''));
        index.push({
          bkid: r.bkid,
          title,
          category: r.cat_name || '',
          tokens,
          joined,
        });
      }
    } catch {
      // Ignore missing schema/table
    }
  }
  return index;
}

export function matchTranslitBooks(
  index,
  query,
  { excluded = new Set(), seenBooks = new Set(), limit = 4 } = {},
) {
  const q = String(query || '').trim();
  if (!Array.isArray(index) || index.length === 0 || q.length < 3 || !containsLatin(q)) {
    return [];
  }

  const queryTokens = latinTextToTokens(q);
  const joinedQuery = collapseRepeats(queryTokens.join(''));
  const aliasArabicTerms = [];
  for (const alias of POPULAR_BOOK_ALIASES) {
    if (alias.pattern.test(q)) {
      aliasArabicTerms.push(...alias.arabicTerms);
    }
  }

  if (queryTokens.length === 0 && aliasArabicTerms.length === 0) {
    return [];
  }

  const scored = [];
  for (const entry of index) {
    if (excluded.has(entry.bkid) || seenBooks.has(entry.bkid)) continue;

    let score = 0;

    // 1. Check popular alias match first (highest confidence)
    for (const term of aliasArabicTerms) {
      if (entry.title.includes(term)) {
        score = Math.max(score, 1000 - entry.title.length);
      }
    }

    // 2. Check consonant skeleton token matching
    if (queryTokens.length > 0 && entry.tokens.length > 0) {
      let matchedTokens = 0;
      let exactTokens = 0;
      for (const qt of queryTokens) {
        let bestForToken = 0;
        for (const bt of entry.tokens) {
          if (bt === qt) {
            bestForToken = 2;
            break;
          }
          if (qt.length >= 3 && bt.startsWith(qt)) {
            bestForToken = Math.max(bestForToken, 1);
          }
        }
        if (bestForToken > 0) {
          matchedTokens += 1;
          if (bestForToken === 2) exactTokens += 1;
        }
      }

      if (matchedTokens === queryTokens.length) {
        score = Math.max(score, 500 + exactTokens * 50 - entry.title.length);
      } else if (joinedQuery.length >= 4 && entry.joined.includes(joinedQuery)) {
        score = Math.max(score, 350 - entry.title.length);
      }
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length);
  return scored.slice(0, limit).map(({ entry }) => ({
    bkid: entry.bkid,
    title: entry.title,
    category: entry.category,
  }));
}
