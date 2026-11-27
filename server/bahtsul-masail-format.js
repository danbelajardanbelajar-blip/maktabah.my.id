const QUESTION_HEADING = /^(?:Pertanyaan|Soal|Permasalahan|Deskripsi\s+Masalah|Masalah|السؤال|سؤال|المسألة)\s*[:：\-–—]?$/i;
const QUESTION_PREFIX = /^(?:Pertanyaan|Soal|Deskripsi\s+Masalah|السؤال|سؤال)\s*[:：\-–—]\s+/i;

const ANSWER_HEADING = /^(?:Jawaban|Jawab|Rumusan(?:\s+Jawaban)?|Keputusan|Hasil\s+Keputusan|Kesimpulan|الجواب|جواب|الإجابة)\s*[:：\-–—]?$/i;
const ANSWER_PREFIX = /^(?:Jawaban|Jawab|Rumusan(?:\s+Jawaban)?|Keputusan|الجواب|جواب|الإجابة)\s*[:：\-–—]\s+/i;

const REFERENCE_HEADING = /^(?:Referensi|Sumber|Daftar\s+Pustaka|Maraji['’]?|Rujukan|المراجع|المصادر)\s*[:：\-–—]?$/i;
const REFERENCE_PREFIX = /^(?:Referensi|Sumber|Daftar\s+Pustaka|Maraji['’]?|Rujukan|المراجع|المصادر)\s*[:：\-–—]\s+/i;

const NEUTRAL_PREFIX = /^(?:Editor|Kontributor|Penulis)\s*[:：]/i;

const HAS_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const HAS_LATIN_WORD = /[A-Za-z]{3,}/;

function isArabicReferenceQuote(clean) {
  return HAS_ARABIC.test(clean) && !HAS_LATIN_WORD.test(clean);
}

/**
 * Classifies a line in a Bahtsul Masail document and tracks the active section
 * ('question' | 'answer' | 'reference' | null) plus whether the line is a reference quote.
 */
export function classifyBahtsulMasailLine(line, currentSection = null) {
  const clean = String(line || '').replace(/<[^>]*>?/gm, '').trim();
  if (!clean) {
    return { section: currentSection, isHeading: false, isReference: false };
  }

  if (QUESTION_HEADING.test(clean)) {
    return { section: 'question', isHeading: true, isReference: false };
  }
  if (QUESTION_PREFIX.test(clean)) {
    return { section: 'question', isHeading: false, isReference: false };
  }

  if (ANSWER_HEADING.test(clean)) {
    return { section: 'answer', isHeading: true, isReference: false };
  }
  if (ANSWER_PREFIX.test(clean)) {
    return { section: 'answer', isHeading: false, isReference: false };
  }

  if (REFERENCE_HEADING.test(clean)) {
    return { section: 'reference', isHeading: true, isReference: true };
  }
  if (REFERENCE_PREFIX.test(clean)) {
    return { section: 'reference', isHeading: false, isReference: true };
  }

  if (NEUTRAL_PREFIX.test(clean)) {
    return { section: null, isHeading: false, isReference: false };
  }

  if (currentSection === 'reference') {
    return { section: 'reference', isHeading: false, isReference: true };
  }

  if ((currentSection === 'question' || currentSection === 'answer') && isArabicReferenceQuote(clean)) {
    return { section: currentSection, isHeading: false, isReference: true };
  }

  return { section: currentSection, isHeading: false, isReference: false };
}
