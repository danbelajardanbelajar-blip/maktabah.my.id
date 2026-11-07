export function showOpeningBismillah(surah:number|null,ayah:number|undefined) {
  // Al-Fatihah's first verse already contains the basmalah; At-Tawbah has no opening banner.
  return surah !== null && surah !== 1 && surah !== 9 && ayah === 1;
}
