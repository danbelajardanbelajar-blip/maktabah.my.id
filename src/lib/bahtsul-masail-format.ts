export type BahtsulMasailSection = 'question' | 'answer' | null;

const QUESTION_HEADING = /^(?:Pertanyaan|Soal|Permasalahan|Deskripsi\s+Masalah|Masalah|السؤال|سؤال|المسألة)\s*[:：\-–—]?$/i;
const QUESTION_PREFIX = /^(?:Pertanyaan|Soal|Deskripsi\s+Masalah|السؤال|سؤال)\s*[:：\-–—]\s+/i;

const ANSWER_HEADING = /^(?:Jawaban|Jawab|Rumusan(?:\s+Jawaban)?|Keputusan|Hasil\s+Keputusan|Kesimpulan|الجواب|جواب|الإجابة)\s*[:：\-–—]?$/i;
const ANSWER_PREFIX = /^(?:Jawaban|Jawab|Rumusan(?:\s+Jawaban)?|Keputusan|الجواب|جواب|الإجابة)\s*[:：\-–—]\s+/i;

const NEUTRAL_PREFIX = /^(?:Editor|Kontributor|Penulis|Sumber|Referensi|Daftar\s+Pustaka)\s*[:：]/i;

export function classifyBahtsulMasailLine(
  line: string,
  currentSection: BahtsulMasailSection = null
): { section: BahtsulMasailSection; isHeading: boolean } {
  const clean = String(line || '').replace(/<[^>]*>?/gm, '').trim();
  if (!clean) {
    return { section: currentSection, isHeading: false };
  }

  if (QUESTION_HEADING.test(clean)) {
    return { section: 'question', isHeading: true };
  }
  if (QUESTION_PREFIX.test(clean)) {
    return { section: 'question', isHeading: false };
  }

  if (ANSWER_HEADING.test(clean)) {
    return { section: 'answer', isHeading: true };
  }
  if (ANSWER_PREFIX.test(clean)) {
    return { section: 'answer', isHeading: false };
  }

  if (NEUTRAL_PREFIX.test(clean)) {
    return { section: null, isHeading: false };
  }

  return { section: currentSection, isHeading: false };
}
