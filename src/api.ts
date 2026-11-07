const API_BASE = '/api'; // Use relative path for production (served by Express) or proxy in dev

async function fetchAPI(endpoint: string, signal?:AbortSignal) {
  const res = await fetch(`${API_BASE}${endpoint}`,{signal});
  if (!res.ok) {
    let errText = `${res.status}`;
    try {
        const errObj = await res.clone().json();
        errText = errObj.error || errObj.message || errText;
    } catch (e) {}
    throw new Error(`API error: ${errText}`);
  }
  return res.json();
}

async function fetchQuran(endpoint:string,signal?:AbortSignal) {
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  const timer=setTimeout(cancel,20000);
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
  try {return await fetchAPI(endpoint,controller.signal);}
  finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}

const deletionStorageKey = 'maktabah-pending-deletion';
const rememberDeletion = (id: string | null) => {
  try { if (id) localStorage.setItem(deletionStorageKey, id); else localStorage.removeItem(deletionStorageKey); } catch {}
};
async function waitForDeletion(token: string, job: any, onProgress?: (message: string) => void): Promise<any> {
  if (!job?.id) return job;
  rememberDeletion(job.id);
  while (job.status === 'running') {
    const progress = job.progress;
    onProgress?.(progress?.totalBooks !== undefined
      ? `Sedang menghapus: ${progress.booksDone} dari ${progress.totalBooks} kitab, ${progress.pagesDone} halaman diproses. Menunggu transaksi selesai…`
      : 'Penghapusan berjalan di latar belakang. Mohon tunggu…');
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const response = await fetch(`${API_BASE}/admin/deletion-jobs/${job.id}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      if (response.status === 401) throw new Error('401');
      if (response.status === 404) throw new Error('Status penghapusan tidak ditemukan. Muat ulang daftar sebelum mencoba lagi.');
      if (!response.ok) { onProgress?.('Koneksi status terganggu. Penghapusan di server mungkin masih berjalan; mencoba memantau kembali…'); continue; }
      job = await response.json();
    } catch (error: any) {
      if (error.message === '401' || error.message.includes('tidak ditemukan')) throw error;
      onProgress?.('Koneksi terputus. Penghapusan di server mungkin masih berjalan; mencoba memantau kembali…');
    }
  }
  rememberDeletion(null);
  if (job.status !== 'done') throw new Error(job.error || 'Penghapusan dibatalkan.');
  return { success: true, deleted: job.deleted };
}

export const webAPI = {
  resumeDeletion: async (token: string, onProgress: (message: string) => void) => {
    let id;
    try { id = localStorage.getItem(deletionStorageKey); } catch {}
    return id ? waitForDeletion(token, { id, status: 'running' }, onProgress) : null;
  },

  // ===== ADMIN AUTH =====
  adminLogin: async (credentials: any) => {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },

  getAdminStats: async (token: string) => {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },

  // ===== ADMIN CATEGORIES =====
  getAdminCategories: async (token: string) => {
    const res = await fetch(`${API_BASE}/admin/categories`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  updateAdminCategory: async (token: string, id: number, data: any) => {
    const res = await fetch(`${API_BASE}/admin/category/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return res.json();
  },
  deleteAdminCategory: async (token: string, id: number, onProgress?: (message: string) => void) => {
    const res = await fetch(`${API_BASE}/admin/category/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return waitForDeletion(token, await res.json(), onProgress);
  },
  bulkDeleteCategories: async (token: string, categoryIds: number[], onProgress?: (message: string) => void) => {
    const res = await fetch(`${API_BASE}/admin/categories/bulk-delete`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return waitForDeletion(token, await res.json(), onProgress);
  },
  // ===== ADMIN SUBMISSIONS =====
  getFeedback: async (token: string, page = 1) => { const r = await fetch(`${API_BASE}/admin/feedback?page=${page}`, { headers: { 'Authorization': `Bearer ${token}` } }); return r.json(); },
  deleteFeedback: async (token: string, id: number) => { const r = await fetch(`${API_BASE}/admin/feedback/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); return r.json(); },
  getBookRequests: async (token: string, page = 1) => { const r = await fetch(`${API_BASE}/admin/book-requests?page=${page}`, { headers: { 'Authorization': `Bearer ${token}` } }); return r.json(); },
  updateBookRequestStatus: async (token: string, id: number, status: string) => { const r = await fetch(`${API_BASE}/admin/book-request/${id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); return r.json(); },
  deleteBookRequest: async (token: string, id: number) => { const r = await fetch(`${API_BASE}/admin/book-request/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); return r.json(); },
  getBookSubmissions: async (token: string, page = 1) => { const r = await fetch(`${API_BASE}/admin/book-submissions?page=${page}`, { headers: { 'Authorization': `Bearer ${token}` } }); return r.json(); },
  updateBookSubmissionStatus: async (token: string, id: number, status: string) => { const r = await fetch(`${API_BASE}/admin/book-submission/${id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); return r.json(); },
  deleteBookSubmission: async (token: string, id: number) => { const r = await fetch(`${API_BASE}/admin/book-submission/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); return r.json(); },

  // ===== ADMIN BOOKS =====
  getAdminBooks: async (token: string, page = 1, query = '', catId?: number, limit = 30) => {
    let url = `${API_BASE}/admin/books?page=${page}&limit=${limit}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (catId !== undefined) url += `&cat=${catId}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  updateAdminBook: async (token: string, bookId: number, data: any) => {
    const res = await fetch(`${API_BASE}/admin/book/${bookId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return res.json();
  },
  
  bulkMoveBooks: async (token: string, bookIds: number[], newCategoryId: number) => {
    const res = await fetch(`${API_BASE}/admin/books/bulk-move`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookIds, newCategoryId })
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  bulkDeleteBooks: async (token: string, bookIds: number[], onProgress?: (message: string) => void) => {
    const res = await fetch(`${API_BASE}/admin/books/bulk-delete`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookIds })
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return waitForDeletion(token, await res.json(), onProgress);
  },
  deleteAdminBook: async (token: string, bookId: number, onProgress?: (message: string) => void) => {
    const res = await fetch(`${API_BASE}/admin/book/${bookId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return waitForDeletion(token, await res.json(), onProgress);
  },

  // ===== ADMIN PAGES =====
  getAdminBookPages: async (token: string, bookId: number, page = 1, limit = 20) => {
    const res = await fetch(`${API_BASE}/admin/book/${bookId}/pages?page=${page}&limit=${limit}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  getAdminPage: async (token: string, bookId: number, pageId: number) => {
    const res = await fetch(`${API_BASE}/admin/page/${bookId}/${pageId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  updateAdminPage: async (token: string, bookId: number, pageId: number, data: any) => {
    const res = await fetch(`${API_BASE}/admin/page/${bookId}/${pageId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return res.json();
  },
  deleteAdminPage: async (token: string, bookId: number, pageId: number) => {
    const res = await fetch(`${API_BASE}/admin/page/${bookId}/${pageId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `${res.status}`); }
    return res.json();
  },



  askAI: async (query: string) => {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    });
    
    let data;
    try {
        data = await res.json();
    } catch (e) {
        await res.text().catch(() => '');
        throw new Error(`Server returned invalid response (Status ${res.status}). Ini biasanya karena koneksi terputus atau server sedang sibuk (Timeout).`);
    }

    if (!res.ok) {
        if (data.message) {
            throw new Error(data.message);
        }
        throw new Error(`API error: ${res.status}`);
    }
    return data;
  },

  search: async (query: string, page = 1, limit = 50, cat_id?: number | string) => {
    let url = `/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (cat_id) url += `&cat_id=${cat_id}`;
    return fetchAPI(url);
  },
  
  searchTitles: async (query: string, page = 1, limit = 20, cat_id?: number | string) => {
    let url = `/search_titles?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (cat_id) url += `&cat_id=${cat_id}`;
    return fetchAPI(url);
  },
  searchScholarium: async (query: string, page = 1) => {
    return fetchAPI(`/search_scholarium?q=${encodeURIComponent(query)}&page=${page}`);
  },
  searchArchive: async (query: string, page = 1) => {
    return fetchAPI(`/search_archive?q=${encodeURIComponent(query)}&page=${page}`);
  },
  getBookInfo: async (bookId: number) => {
    return fetchAPI(`/book/${bookId}`);
  },
  getToc: async (bookId: number) => {
    return fetchAPI(`/toc/${bookId}`);
  },
  getPage: async (bookId: number, pageId?: number) => {
    return fetchAPI(`/book/${bookId}/page${pageId ? `/${pageId}` : ''}`);
  },
  getFirstPage: async (bookId: number) => {
    return fetchAPI(`/book/${bookId}/first`);
  },
  getLastPage: async (bookId: number) => {
    return fetchAPI(`/book/${bookId}/last`);
  },
  getNextJuz: async (bookId: number, currentPageId: number) => {
    return fetchAPI(`/book/${bookId}/next_juz/${currentPageId}`);
  },
  getPrevJuz: async (bookId: number, currentPageId: number) => {
    return fetchAPI(`/book/${bookId}/prev_juz/${currentPageId}`);
  },
  getNextPage: async (bookId: number, currentPageId: number) => {
    return fetchAPI(`/book/${bookId}/next/${currentPageId}`);
  },
  getPrevPage: async (bookId: number, currentPageId: number) => {
    return fetchAPI(`/book/${bookId}/prev/${currentPageId}`);
  },
  getMatnSharh: async (bookId: number, pageId: number) => {
    return fetchAPI(`/matn_sharh/${bookId}/${pageId}`);
  },
  getQuranSurahs: async (signal?:AbortSignal) => {
    return fetchQuran(`/quran/surahs`,signal);
  },
  getQuranAyahs: async (surahId: number,signal?:AbortSignal) => {
    return fetchQuran(`/quran/surah/${surahId}`,signal);
  },
  getCategories: async () => {
    return fetchAPI(`/categories`);
  },
  getCategoryBooks: async (categoryId: number, page?: number, query = '', limit = 30) => {
    const params = page === undefined ? '' : `?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`;
    return fetchAPI(`/category/${categoryId}/books${params}`);
  },
  getRecentSearches: async () => {
    return fetchAPI(`/recent-searches`);
  },
  getRecentQuestions: async () => {
    return fetchAPI(`/recent-questions`);
  },

  // ===== TAFSIR (Multi-DB) =====
  /**
   * Ambil daftar kitab tafsir untuk surah tertentu.
   * Mengembalikan array: { id, surah_id, ayah_no, book_id, page_id, tafsir_name }
   */
  getTafsirBySurah: async (surahId: number,signal?:AbortSignal) => {
    return fetchQuran(`/quran/tafsir/${surahId}`,signal);
  },

  /**
   * Ambil isi halaman tafsir berdasarkan book_id + page_id dari tafsir_ayah_mapping.
   * Mengembalikan: { data: { id, book_id, part, page, text } }
   */
  getTafsirPage: async (bookId: number, pageId: number,signal?:AbortSignal) => {
    return fetchQuran(`/quran/tafsir-page/${bookId}/${pageId}`,signal);
  },
  // ===== ADMIN LOGS =====
  getAdminLogs: async (token: string, type: string) => {
    const res = await fetch(`${API_BASE}/admin/logs/${type}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  
  // ===== CLIENT LOGS =====
  
  logDownload: async (title: string, id?: number) => {
    const res = await fetch(`${API_BASE}/log/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_title: title, book_id: id })
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  logVisit: async (path: string) => {
    const res = await fetch(`${API_BASE}/log/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },

  // ===== KAMUS PERAWI =====
  searchRowa: async (q: string, page = 1, limit = 20) => {
    const res = await fetch(`${API_BASE}/rowa/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
    if (!res.ok) {
      let errText = `${res.status}`;
      try { const o = await res.clone().json(); errText = o.error || errText; } catch(e) {}
      throw new Error(errText);
    }
    return res.json();
  },

  getRowaInfo: async (id: number) => {
    const res = await fetch(`${API_BASE}/rowa/${id}`);
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },

};

