export const COMPILERS_MAPPING = [
  { match: /بخار[يى]/u, label: 'صحيح البخاري' },
  { match: /(^|[^\p{L}\p{N}])مسلم([^\p{L}\p{N}]|$)/u, label: 'صحيح مسلم' },
  { match: /أب[يو]\s+داود|اب[يو]\s+داود/u, label: 'سنن أبي داود' },
  { match: /ترمذ[يى]/u, label: 'جامع الترمذي' },
  { match: /نسائ[يى]/u, label: 'سنن النسائي' },
  { match: /ابن\s+ماج[ةه]/u, label: 'سنن ابن ماجه' },
  { match: /أحمد\s+بن\s+حنبل|احمد\s+بن\s+حنبل/u, label: 'مسند أحمد' },
  { match: /مالك\s+بن\s+أنس|مالك\s+بن\s+انس|(^|[^\p{L}\p{N}])مالك([^\p{L}\p{N}]|$)/u, label: 'موطأ مالك' },
  { match: /دارم[يى]/u, label: 'سنن الدارمي' }
];

/**
 * Extracts famous hadith books (Kutubus Sittah & Kutubut Tis'ah)
 * from narrator's students list (telmez / rawahu 'anhu).
 */
export function extractKutubList(telmez) {
  if (!telmez || typeof telmez !== 'string') return [];
  const entries = telmez.split('#').map(e => e.trim()).filter(Boolean);
  const found = new Set();
  for (const entry of entries) {
    for (const { match, label } of COMPILERS_MAPPING) {
      if (match.test(entry)) {
        found.add(label);
      }
    }
  }
  return Array.from(found);
}

/**
 * Returns a hash-separated string of books for database/API compatibility.
 */
export function extractKutubString(telmez) {
  const list = extractKutubList(telmez);
  return list.length > 0 ? list.join(' # ') : '';
}
