export type AdminView = 'authors_database' | 'authors_review' | 'rowa_database' | 'storage' | 'ai_settings' | 'categories' | 'books' | 'pages' | 'edit_page' | 'transfer' | 'feedback' | 'requests' | 'submissions' | 'log_search' | 'log_download' | 'log_visit' | 'log_quran' | 'log_rowa' | 'log_ask';

const parents: Record<AdminView, AdminView> = {
  authors_database:'categories',authors_review:'authors_database',
  rowa_database:'categories',
  categories:'categories', books:'categories', pages:'books', edit_page:'pages', transfer:'categories',
  feedback:'categories', requests:'categories', submissions:'categories', ai_settings:'categories', storage:'categories',
  log_search:'categories', log_download:'categories', log_visit:'categories', log_quran:'categories', log_rowa:'categories', log_ask:'categories',
};
const titles: Record<AdminView,string> = {
  authors_database:'Database Penulis',authors_review:'Tinjau Relasi Penulis',
  rowa_database:'Database Perawi',
  categories:'Database Kitab', books:'Database Kitab', pages:'Database Kitab', edit_page:'Database Kitab',
  transfer:'Import / Export', feedback:'Masukan', requests:'Permintaan Kitab', submissions:'Kiriman Kitab', ai_settings:'Pengaturan AI', storage:'Backup & Penyimpanan',
  log_search:'Log Pencarian', log_download:'Log Unduhan', log_visit:'Log Kunjungan', log_quran:"Log Al-Qur’an", log_rowa:'Log Perawi', log_ask:'Log Tanya AI',
};
export const adminParent = (view: AdminView) => parents[view];
export const adminTitle = (view: AdminView) => titles[view];
export const adminGroups: {label:string;views:AdminView[]}[] = [
  {label:'Kitab',views:['categories']},{label:'Penulis',views:['authors_database','authors_review']},{label:'Transfer',views:['transfer','rowa_database']},
  {label:'Aktivitas',views:['log_visit','log_search','log_download','log_quran','log_rowa','log_ask']},
  {label:'Masukan',views:['feedback','requests','submissions']},{label:'Pengaturan',views:['ai_settings','storage']},
];
export const adminGroup = (view:AdminView) => ['books','pages','edit_page'].includes(view)?'Kitab':adminGroups.find(g=>g.views.includes(view))?.label||'Kitab';
export function adminLocation(hash:string) {
  const p=new URLSearchParams(hash.split('?')[1]||'');
  const raw=p.get('view')||'categories';const view:AdminView=Object.hasOwn(titles,raw)?raw as AdminView:'categories';
  const id=(name:string,zero=false)=>{const v=p.get(name);return v!==null&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)>=(zero?0:1)?Number(v):undefined;};
  return {view,categoryId:id('cat',true),bookId:id('book'),pageId:id('pid',true)};
}
