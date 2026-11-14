export interface AiQueryDetectionResult {
  shouldRedirect: boolean;
  reason: 'question_word' | 'question_mark' | 'none';
  matchedKeywords: string[];
  wordCount: number;
}

const QUESTION_MARKS_REGEX = /[?؟]/;

// Indonesian & English question / intent keywords (exact word match)
const QUESTION_WORDS_INDONESIAN_ENGLISH = new Set([
  // Kata tanya Indonesia
  'apa', 'apakah', 'siapa', 'siapakah', 'bagaimana', 'bagaimanakah', 'gimana',
  'mengapa', 'kenapa', 'kapan', 'kapankah', 'dimana', 'dimanakah', 'kemana',
  'kemanakah', 'darimana', 'darimanakah', 'berapa', 'berapakah',
  // Kata hukum / fikih & tindakan
  'hukum', 'hukumnya', 'bolehkah', 'bisakah', 'dapatkah', 'haruskah', 'wajibkah',
  'adakah', 'benarkah', 'sahkah', 'sunnahkah', 'haramkah', 'makruhkah', 'batalkah',
  // Perintah / permintaan penjelasan
  'jelaskan', 'sebutkan', 'terangkan', 'uraikan', 'paparkan', 'tafsirkan',
  'tolong', 'carikan', 'tanyakan', 'mohon',
  // Konsep agama umum dalam pertanyaan
  'dalil', 'dalilnya', 'hadits', 'haditsnya',
  'pengertian', 'definisi', 'maksud', 'makna', 'arti', 'artinya',
  'syarat', 'rukun', 'perbedaan', 'keutamaan',
  // English question words
  'what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain'
]);

// Multi-word phrase triggers (e.g. "apa hukum", "bagaimana cara")
const QUESTION_PHRASES = [
  'apa hukum', 'apa itu', 'apa maksud', 'apa makna', 'apa arti',
  'bagaimana cara', 'bagaimana hukum', 'apakah boleh', 'apakah sah', 'apakah wajib',
  'apa dalil', 'menurut ulama', 'menurut mazhab', 'menurut madzhab', 'menurut pandangan',
  'tata cara', 'cara melakukan', 'cara mengamalkan', 'hukum seputar', 'hukum terkait',
  'is it allowed', 'is it permissible', 'what is', 'how to'
];

// Arabic question particles and prefixes
const ARABIC_QUESTION_EXACT_WORDS = new Set([
  'هل', 'ماذا', 'كيف', 'أين', 'اين', 'متى', 'لماذا', 'كم', 'أنى', 'انى', 'أيان', 'ايان'
]);

// Arabic multi-word question phrases
const ARABIC_QUESTION_PHRASES = [
  'ما حكم', 'ما معنى', 'ما هو', 'ما هي', 'ما هم',
  'هل يجوز', 'هل يصح', 'هل يجب', 'هل يستحب', 'هل يكره', 'هل يحرم', 'هل يبطل',
  'ما الدليل', 'ما الفرق', 'كيفية صلاة', 'كيفية وضوء', 'كيفية غسل',
  'من هو', 'من هي', 'من هم', 'من قال'
];

/**
 * Normalizes text for intent detection:
 * - strips Arabic harakat (tashkeel)
 * - normalizes Arabic alef variants
 * - lowercases Latin characters
 */
export function normalizeQueryForDetection(text: string): string {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip harakat
    .replace(/[\u0622\u0623\u0625]/g, '\u0627'); // normalize alef
}

/**
 * Routes a search query to the AI Assistant only when it contains a question mark
 * or a recognized question/intent keyword or phrase, regardless of query length.
 */
export function detectAiQuery(rawQuery: string): AiQueryDetectionResult {
  const trimmed = String(rawQuery ?? '').trim();
  if (!trimmed) {
    return { shouldRedirect: false, reason: 'none', matchedKeywords: [], wordCount: 0 };
  }

  // 1. Check for Question Marks (? or Arabic ؟)
  if (QUESTION_MARKS_REGEX.test(trimmed)) {
    return {
      shouldRedirect: true,
      reason: 'question_mark',
      matchedKeywords: ['?'],
      wordCount: trimmed.split(/\s+/).length
    };
  }

  const normalized = normalizeQueryForDetection(trimmed);
  // Split into individual clean tokens (letters and numbers only)
  const tokens = normalized
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = tokens.length;
  if (wordCount === 0) {
    return { shouldRedirect: false, reason: 'none', matchedKeywords: [], wordCount: 0 };
  }

  // 2. Check for Multi-Word Phrases (Indonesian, English, Arabic)
  const matchedPhrases: string[] = [];
  for (const phrase of QUESTION_PHRASES) {
    if (normalized.includes(phrase)) {
      matchedPhrases.push(phrase);
    }
  }
  for (const arabicPhrase of ARABIC_QUESTION_PHRASES) {
    const normArabicPhrase = normalizeQueryForDetection(arabicPhrase);
    if (normalized.includes(normArabicPhrase)) {
      matchedPhrases.push(arabicPhrase);
    }
  }

  if (matchedPhrases.length > 0) {
    return {
      shouldRedirect: true,
      reason: 'question_word',
      matchedKeywords: matchedPhrases,
      wordCount
    };
  }

  // 3. Check for Exact Question Words (Indonesian, English, Arabic)
  const matchedWords: string[] = [];
  for (const token of tokens) {
    if (QUESTION_WORDS_INDONESIAN_ENGLISH.has(token)) {
      matchedWords.push(token);
    }
    if (ARABIC_QUESTION_EXACT_WORDS.has(token)) {
      matchedWords.push(token);
    }
    // Arabic "ما" check: if standalone word in query with > 1 words
    if (token === 'ما' && wordCount >= 2) {
      matchedWords.push(token);
    }
  }

  if (matchedWords.length > 0) {
    return {
      shouldRedirect: true,
      reason: 'question_word',
      matchedKeywords: matchedWords,
      wordCount
    };
  }

  return {
    shouldRedirect: false,
    reason: 'none',
    matchedKeywords: [],
    wordCount
  };
}
