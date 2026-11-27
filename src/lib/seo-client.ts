import type { AppTab } from './navigation';

const SITE_URL = 'https://maktab.my.id';
const DEFAULT_TITLE = 'al Maktabah as Sunniyyah — Perpustakaan Kitab Islam Digital | المكتبة السنية';

const TAB_DESCRIPTIONS: Partial<Record<AppTab, string>> = {
  home: 'Perpustakaan kitab Islam digital berbahasa Arab dan Indonesia. Telusuri ribuan kitab kuning, kutub hadis, tafsir Al-Qur\'an, dan kamus perawi gratis.',
  catalog: 'Katalog lengkap kitab Islam klasik di al Maktabah as Sunniyyah berdasarkan kategori keilmuan.',
  hadith: 'Koleksi kitab induk hadis (Kutub Tis\'ah dan lainnya) beserta pencarian matan dan edisi.',
  authors: 'Direktori ulama dan penulis kitab Islam klasik beserta biografi dan daftar karyanya.',
  rowa: 'Kamus perawi hadis lengkap dengan kunyah, tabaqah, dan keterangan jarh wa ta\'dil.',
  quran: 'Baca Al-Qur\'an digital lengkap dengan terjemahan dan rujukan kitab tafsir.',
  about: 'Tentang layanan perpustakaan digital al Maktabah as Sunniyyah.',
  privacy: 'Kebijakan Privasi layanan al Maktabah as Sunniyyah dan kontak pengelola.',
};

const CANONICAL_PATHS: Partial<Record<AppTab, string>> = {
  home: '/',
  catalog: '/katalog',
  hadith: '/kutub-hadis',
  authors: '/penulis',
  rowa: '/perawi',
  privacy: '/privacy-policy',
};

const NOINDEX_TABS = new Set<AppTab>(['admin', 'settings', 'collection', 'search', 'advanced_search', 'ask']);

function upsertMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export function syncDocumentSeo(tab: AppTab, label: string) {
  if (typeof document === 'undefined') return;
  document.title = tab === 'home' ? DEFAULT_TITLE : `${label} — al Maktabah as Sunniyyah`;

  const description = TAB_DESCRIPTIONS[tab] || TAB_DESCRIPTIONS.home!;
  upsertMeta('description', description);
  upsertMeta('robots', NOINDEX_TABS.has(tab) ? 'noindex, nofollow' : 'index, follow');

  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    const canonicalPath = CANONICAL_PATHS[tab] || '/';
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `${SITE_URL}${canonicalPath}`;
  }
}
