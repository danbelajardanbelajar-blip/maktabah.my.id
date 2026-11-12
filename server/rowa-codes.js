// Explicit source symbols, not person-name matching. Unknown symbols remain visible.
// Ibn Hajar, Taqrib al-Tahdhib, introduction (public domain).
export const CODE_SOURCE = 'https://ar.wikisource.org/wiki/تقريب_التهذيب/المقدمة';
export const BOOK_CODES = {
  'خ':'صحيح البخاري', 'خت':'صحيح البخاري — المعلقات', 'بخ':'الأدب المفرد للبخاري',
  'عخ':'خلق أفعال العباد للبخاري', 'ر':'جزء القراءة للبخاري', 'ي':'رفع اليدين للبخاري',
  'م':'صحيح مسلم', 'مق':'مقدمة صحيح مسلم', 'د':'سنن أبي داود', 'مد':'المراسيل لأبي داود',
  'صد':'فضائل الأنصار لأبي داود', 'خد':'الناسخ والمنسوخ لأبي داود', 'قد':'القدر لأبي داود',
  'ف':'التفرد لأبي داود', 'ل':'المسائل لأبي داود', 'كد':'مسند مالك لأبي داود',
  'ت':'جامع الترمذي', 'تم':'الشمائل للترمذي', 'س':'سنن النسائي',
  'عس':'مسند علي للنسائي', 'كن':'مسند مالك للنسائي', 'سي':'عمل اليوم والليلة للنسائي',
  'ص':'خصائص علي للنسائي', 'ق':'سنن ابن ماجه', 'فق':'تفسير ابن ماجه',
};
export function decodeWho(who) {
  const symbols = [...new Set(String(who || '').trim().split(/[\s،,;؛()]+/u).filter(Boolean))];
  const canonical = symbols.map(s=>s==='ى'?'ي':s==='سى'?'سي':s);
  const unknown = canonical.filter(s => !BOOK_CODES[s] && !['ع','4','٤','تمييز'].includes(s));
  const expanded = canonical.flatMap(s => s === 'ع' ? ['خ','م','د','ت','س','ق'] : ['4','٤'].includes(s) ? ['د','ت','س','ق'] : [s]);
  return {
    symbols,
    // Narrative annotations may qualify/deny a code (e.g. Muslim's introduction).
    // Do not turn a partially parsed annotation into an unqualified book badge.
    books: unknown.length ? [] : [...new Set(expanded)].filter(s => BOOK_CODES[s]).map(code => ({code, label: BOOK_CODES[code]})),
    unknown,
    distinctionOnly: symbols.includes('تمييز'),
  };
}
export function withRowaSources(row) {
  const decoded = decodeWho(row.WHO);
  return {...row, kutub: decoded.books.map(b => b.label).join(' # '), book_symbols: decoded.symbols,
    books: decoded.books, unknown_book_symbols: decoded.unknown, distinction_only: decoded.distinctionOnly,
    kutub_source: row.WHO?.trim() ? 'WHO' : null, book_code_reference: CODE_SOURCE};
}
