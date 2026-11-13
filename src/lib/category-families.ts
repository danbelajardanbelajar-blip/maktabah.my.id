export type CategoryFamily = 'bahsul-masail' | 'turats';
export interface NamedCategory { id: number; name: string; }

// Classify the displayed title, never its ID or the books stored underneath it.
// Ignore digits, punctuation and vowel marks. Mixed titles follow the dominant
// alphabet; a tie with Arabic letters belongs to Turats. Latin/empty titles use
// the Indonesian group, so every category remains accessible.
export function categoryFamily(name: string): CategoryFamily {
  const letters = String(name ?? '').normalize('NFKC').match(/\p{L}/gu) ?? [];
  const arabic = letters.filter(letter => /\p{Script_Extensions=Arabic}/u.test(letter)).length;
  const latin = letters.filter(letter => /\p{Script=Latin}/u.test(letter)).length;
  return arabic > 0 && arabic >= latin ? 'turats' : 'bahsul-masail';
}

export function groupCategoryFamilies<T extends NamedCategory>(categories: T[]) {
  return [
    { id: 'bahsul-masail' as const, title: 'Hasil Bahsul Masail', description: 'Kategori dengan nama berbahasa Indonesia.', categories: categories.filter(category => categoryFamily(category.name) === 'bahsul-masail') },
    { id: 'turats' as const, title: 'Kitab Turats', description: 'Kategori dengan nama berbahasa Arab.', categories: categories.filter(category => categoryFamily(category.name) === 'turats') },
  ];
}
