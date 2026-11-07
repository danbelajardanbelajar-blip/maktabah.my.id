export type AdminView = 'ai_settings' | 'categories' | 'books' | 'pages' | 'edit_page' | 'transfer' | 'feedback' | 'requests' | 'submissions' | 'log_search' | 'log_download' | 'log_visit' | 'log_quran' | 'log_rowa' | 'log_ask';

const parents: Record<AdminView, AdminView> = {
  categories:'categories', books:'categories', pages:'books', edit_page:'pages', transfer:'categories',
  feedback:'categories', requests:'categories', submissions:'categories', ai_settings:'categories',
  log_search:'categories', log_download:'categories', log_visit:'categories', log_quran:'categories', log_rowa:'categories', log_ask:'categories',
};
const titles: Record<AdminView,string> = {
  categories:'Database Kitab', books:'Database Kitab', pages:'Database Kitab', edit_page:'Database Kitab',
  transfer:'Import / Export', feedback:'Masukan', requests:'Permintaan Kitab', submissions:'Kiriman Kitab', ai_settings:'Pengaturan AI',
  log_search:'Log Pencarian', log_download:'Log Unduhan', log_visit:'Log Kunjungan', log_quran:"Log Al-Qur’an", log_rowa:'Log Perawi', log_ask:'Log Tanya AI',
};
export const adminParent = (view: AdminView) => parents[view];
export const adminTitle = (view: AdminView) => titles[view];
