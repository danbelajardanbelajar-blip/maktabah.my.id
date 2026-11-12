export type AppTab = 'authors' | 'home' | 'search' | 'advanced_search' | 'catalog' | 'quran' | 'rowa' | 'about' | 'privacy' | 'settings' | 'more' | 'ask' | 'admin' | 'feedback' | 'book_request' | 'book_submit' | 'collection';
const paths: Record<AppTab,string> = {authors:'penulis',home:'beranda',search:'cari',advanced_search:'cari',catalog:'katalog',quran:'quran',rowa:'perawi',about:'tentang',privacy:'privasi',settings:'pengaturan',more:'lainnya',ask:'tanya-ai',admin:'admin',feedback:'masukan',book_request:'permintaan-kitab',book_submit:'kirim-kitab',collection:'koleksi'};
export function parseNavigation(hash: string, search = '') {
  const [name, query = ''] = hash.replace(/^#\/?/,'').split('?');
  const params = new URLSearchParams(query);
  const found = Object.entries(paths).find(([key,value]) => value===name && key!=='advanced_search');
  let tab: AppTab = found ? found[0] as AppTab : !name && new URLSearchParams(search).get('admin')==='1' ? 'admin' : 'home';
  if(tab==='search' && params.get('filters')==='1')tab='advanced_search';
  return {tab,params};
}
export function navigationHash(tab: AppTab, values: Record<string,string|number|undefined> = {}) {
  const params = new URLSearchParams();
  for(const [key,value] of Object.entries(values))if(value!==undefined && String(value)!=='')params.set(key,String(value));
  if(tab==='advanced_search')params.set('filters','1');
  return `#/${paths[tab]}${params.size?'?'+params:''}`;
}
export const routePage = (value: string|null) => Math.max(1,Math.min(100000,Number.isSafeInteger(Number(value))?Number(value):1));
export const routeCategories = (value: string|null) => [...new Set((value||'').split(',').filter(v=>/^\d+$/.test(v)).map(Number).filter(Number.isSafeInteger))];
