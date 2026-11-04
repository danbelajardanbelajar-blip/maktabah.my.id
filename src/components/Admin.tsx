import React, { useState, useEffect, useCallback } from 'react';
import { webAPI } from '../api';
import { LogIn, Edit2, Trash2, Save, X, Search, ChevronLeft, ChevronRight, LogOut, FolderOpen, BookOpen, FileText, ArrowLeft, Eye, AlertTriangle, MessageSquare, BookPlus, Upload , Download, FolderSync, Activity, Calendar, BarChart2 } from 'lucide-react';

// ==================== TYPES ====================
type AdminView = 'categories' | 'books' | 'pages' | 'edit_page' | 'feedback' | 'requests' | 'submissions' | 'log_search' | 'log_download' | 'log_visit' | 'log_quran' | 'log_rowa' | 'log_ask';
interface Category { id: number; name: string; catord: number; lvl: number; book_count: number; }
interface Book { bkid: number; bk: string; cat: number; cat_name: string; }
interface PageRow { id: number; book_id: number; part: number; page: number; preview: string; }

// ==================== HELPERS ====================

const downloadCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csvContent = [
    keys.join(','),
    ...data.map(row => keys.map(k => '"' + String(row[k] || '').replace(/"/g, '""') + '"').join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const SelectionBar = ({ count, onDownload, extraActions }: { count: number, onDownload: () => void, extraActions?: React.ReactNode }) => {
  if (count === 0) return null;
  return (
    <div className="bg-[var(--app-primary)] text-white px-4 py-3 flex items-center justify-between mb-4 rounded-xl shadow-md">
      <span className="font-bold">{count} item dipilih</span>
      <div className="flex gap-2">
        {extraActions}
        <button onClick={onDownload} className="bg-white text-[var(--app-primary)] px-3 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
          <Download size={16}/> Download CSV
        </button>
      </div>
    </div>
  );
};

const adminFetch = (_token: string, fn: () => Promise<any>, onLogout: () => void, setErr: (e: string) => void) =>
  fn().catch((err: any) => {
    if (err.message === '401') { onLogout(); } else { setErr(err.message || 'Terjadi kesalahan'); }
    return null;
  });

const Pagination = ({ page, total, limit, onChange, loading, onLimitChange }: any) => {
  const totalPages = Math.ceil(total / limit);
  if (total <= 0) return null;
  return (
    <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Hal {page} dari {totalPages} ({total} item)</span>
        {onLimitChange && (
          <select 
            value={limit} 
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-md py-1 px-2 bg-white outline-none cursor-pointer"
          >
            <option value={15}>15 per hal</option>
            <option value={20}>20 per hal</option>
            <option value={25}>25 per hal</option>
            <option value={30}>30 per hal</option>
            <option value={50}>50 per hal</option>
            <option value={100}>100 per hal</option>
            <option value={500}>500 per hal</option>
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onChange(page - 1)} disabled={page === 1 || loading} className="p-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={18} /></button>
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages || loading} className="p-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
};

const ErrorBanner = ({ msg, onClose }: { msg: string, onClose: () => void }) => (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2 mb-4">
    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
    <span className="flex-1 text-sm">{msg}</span>
    <button onClick={onClose}><X size={16} /></button>
  </div>
);

// ==================== LOGIN ====================
const LoginForm = ({ onLogin, onClose }: { onLogin: (t: string) => void, onClose: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await webAPI.adminLogin({ username, password });
      if (res.success) onLogin(res.token);
    } catch { setError('Username atau password salah'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1"><X size={20} /></button>
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--app-primary)]/10 text-[var(--app-primary)] rounded-full flex items-center justify-center mx-auto mb-4"><LogIn size={32} /></div>
            <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-4 border border-red-100">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--app-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--app-primary)]" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[var(--app-primary)] text-white font-bold py-3 rounded-xl hover:bg-[var(--app-primary-hover)] disabled:opacity-50 mt-2">
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==================== CATEGORIES VIEW ====================
const CategoriesView = ({ token, onLogout, onSelectCategory }: { token: string, onLogout: () => void, onSelectCategory: (cat: Category) => void }) => {
  const [cats, setCats] = useState<Category[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.id === item.id)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.id === s.id)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.id !== item.id));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getAdminCategories(token), onLogout, setError);
    if (res) setCats(res.data);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = cats.filter(c => !query || c.name.includes(query));

  const handleEdit = async (cat: Category) => {
    if (editingId === cat.id) {
      const res = await adminFetch(token, () => webAPI.updateAdminCategory(token, cat.id, { name: editName }), onLogout, setError);
      if (res?.success) { setEditingId(null); load(); }
    } else {
      setEditingId(cat.id);
      setEditName(cat.name);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Hapus kategori "${cat.name}"? (Hanya bisa jika tidak ada kitab)`)) return;
    const res = await adminFetch(token, () => webAPI.deleteAdminCategory(token, cat.id), onLogout, setError);
    if (res?.success) load();
  };

  const paginated = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b bg-gray-50/50 flex flex-col md:flex-row gap-3 justify-between items-center">
        <h2 className="font-bold text-gray-800 flex items-center gap-2"><FolderOpen size={20} className="text-[var(--app-primary)]" /> Kategori ({cats.length})</h2>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari kategori..." className="pl-9 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:border-[var(--app-primary)] text-sm" />
        </div>
      </div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'categoriesview_export.csv')} />
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b">
            <tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={filtered.length > 0 && filtered.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, filtered)} /></th><th className="px-4 py-3 w-12">ID</th><th className="px-4 py-3">Nama Kategori</th><th className="px-4 py-3 w-20 text-center">Kitab</th><th className="px-4 py-3 w-28 text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">Tidak ada kategori</td></tr>
            ) : paginated.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50/50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.id === cat.id)} onChange={(e) => toggleOne(e, cat)} onClick={(e) => e.stopPropagation()} /></td>
                <td className="px-4 py-3 text-gray-400 text-sm">{cat.id}</td>
                <td className="px-4 py-3">
                  {editingId === cat.id ? (
                    <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus dir="rtl"
                      className="border-2 border-[var(--app-primary)] rounded-lg px-3 py-1.5 w-full text-right focus:outline-none text-lg"
                      style={{ fontFamily: 'var(--arabic-font)' }} />
                  ) : (
                    <button onClick={() => onSelectCategory(cat)} className="font-bold text-gray-800 hover:text-[var(--app-primary)] transition-colors text-lg w-full text-right" dir="auto" style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}>
                      {cat.name}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-[var(--app-primary)]/10 text-[var(--app-primary)] text-xs font-bold px-2 py-1 rounded-full">{cat.book_count}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    {editingId === cat.id ? (
                      <>
                        <button onClick={() => handleEdit(cat)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600"><Save size={15} /></button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-700 p-1.5 rounded-lg hover:bg-gray-300"><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(cat)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg" title="Edit"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(cat)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Hapus"><Trash2 size={16} /></button>
                        <button onClick={() => onSelectCategory(cat)} className="text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 p-1.5 rounded-lg" title="Lihat Kitab"><BookOpen size={16} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    
      <Pagination page={currentPage} total={filtered.length} limit={limit} onLimitChange={(l: any) => { setLimit(l); setCurrentPage(1); }} onChange={(p: number) => setCurrentPage(p)} loading={loading} />
    </div>
  );
};

// ==================== BOOKS VIEW ====================
const BooksView = ({ token, onLogout, category, onSelectBook }: { token: string, onLogout: () => void, category: Category, onSelectBook: (book: Book) => void }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.bkid === item.bkid)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.bkid === s.bkid)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.bkid !== item.bkid));
  };

  const [bulkMoveMode, setBulkMoveMode] = useState(false);
  const [targetCat, setTargetCat] = useState('');
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (bulkMoveMode && allCategories.length === 0) {
      adminFetch(token, () => webAPI.getAdminCategories(token), onLogout, setError).then(res => { if (res && res.data) setAllCategories(res.data); });
    }
  }, [bulkMoveMode]);

  const handleBulkDelete = async () => {
    if (!window.confirm(`Yakin ingin menghapus ${selected.length} kitab?`)) return;
    const ids = selected.map(s => s.bkid);
    const res = await adminFetch(token, () => webAPI.bulkDeleteBooks(token, ids), onLogout, setError);
    if (res?.success) { setSelected([]); load(); }
  };
  
  const handleBulkMove = async () => {
    if (!targetCat) return;
    setMoving(true);
    const ids = selected.map(s => s.bkid);
    const res = await adminFetch(token, () => webAPI.bulkMoveBooks(token, ids, parseInt(targetCat)), onLogout, setError);
    if (res?.success) { setSelected([]); setBulkMoveMode(false); load(); }
    setMoving(false);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(30);

  const load = useCallback(async (p = 1, q = query, l = limit) => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getAdminBooks(token, p, q, category.id, l), onLogout, setError);
    if (res) { setBooks(res.data); setTotal(res.total); setPage(res.page); }
    setLoading(false);
  }, [token, category.id, query, limit]);

  useEffect(() => { load(1, '', limit); }, [category.id]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(1, query, limit); };

  const handleEdit = async (book: Book) => {
    if (editingId === book.bkid) {
      const res = await adminFetch(token, () => webAPI.updateAdminBook(token, book.bkid, { bk: editTitle, cat: book.cat, inf: null }), onLogout, setError);
      if (res?.success) { setEditingId(null); load(page); }
    } else {
      setEditingId(book.bkid);
      setEditTitle(book.bk);
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Hapus kitab "${book.bk}"? Semua halaman isinya akan TERHAPUS PERMANEN!`)) return;
    const res = await adminFetch(token, () => webAPI.deleteAdminBook(token, book.bkid), onLogout, setError);
    if (res?.success) load(page);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b bg-gray-50/50 flex flex-col md:flex-row gap-3 justify-between items-center">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <BookOpen size={20} className="text-[var(--app-primary)]" />
          <span dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{category.name}</span>
          <span className="text-gray-400 text-sm font-normal">({total} kitab)</span>
        </h2>
        <form onSubmit={handleSearch} className="flex w-full md:w-64">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari judul..." className="border rounded-l-lg px-3 py-2 w-full focus:outline-none focus:border-[var(--app-primary)] text-sm" />
          <button type="submit" className="bg-[var(--app-primary)] text-white px-3 py-2 rounded-r-lg hover:bg-[var(--app-primary-hover)]"><Search size={16} /></button>
        </form>
      </div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'books_export.csv')} extraActions={
        <>
          <button onClick={() => setBulkMoveMode(true)} className="bg-yellow-500 text-white px-3 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-yellow-600 transition-colors"><FolderSync size={16}/> Pindah Kategori</button>
          <button onClick={handleBulkDelete} className="bg-red-500 text-white px-3 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-red-600 transition-colors"><Trash2 size={16}/> Hapus</button>
        </>
      } />
      {bulkMoveMode && (
        <div className="mb-4 p-4 border rounded-xl bg-gray-50 flex items-center gap-3">
          <span className="font-bold">Pindah ke kategori:</span>
          <select value={targetCat} onChange={e => setTargetCat(e.target.value)} className="border p-2 rounded flex-1">
            <option value="">-- Pilih Kategori --</option>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={handleBulkMove} disabled={!targetCat || moving} className="bg-[var(--app-primary)] text-white px-4 py-2 rounded font-bold hover:bg-[var(--app-primary-hover)] disabled:opacity-50">{moving ? 'Memproses...' : 'Pindahkan'}</button>
          <button onClick={() => setBulkMoveMode(false)} className="text-gray-500 hover:text-gray-800">Batal</button>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b">
            <tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={books.length > 0 && books.every((item: any) => selected.find((s: any) => s.bkid === item.bkid))} onChange={(e) => toggleAll(e, books)} /></th><th className="px-4 py-3 w-12">ID</th><th className="px-4 py-3">Judul Kitab</th><th className="px-4 py-3 w-32 text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Memuat...</td></tr>
            ) : books.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Tidak ada kitab</td></tr>
            ) : books.map(book => (
              <tr key={book.bkid} className="hover:bg-gray-50/50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.bkid === book.bkid)} onChange={(e) => toggleOne(e, book)} onClick={(e) => e.stopPropagation()} /></td>
                <td className="px-4 py-3 text-gray-400 text-sm">{book.bkid}</td>
                <td className="px-4 py-3">
                  {editingId === book.bkid ? (
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus dir="rtl"
                      className="border-2 border-[var(--app-primary)] rounded-lg px-3 py-1.5 w-full text-right focus:outline-none text-lg"
                      style={{ fontFamily: 'var(--arabic-font)' }} />
                  ) : (
                    <button onClick={() => onSelectBook(book)} className="font-bold text-gray-800 hover:text-[var(--app-primary)] transition-colors text-base w-full text-right" dir="auto" style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}>
                      {book.bk}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    {editingId === book.bkid ? (
                      <>
                        <button onClick={() => handleEdit(book)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600"><Save size={15} /></button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-700 p-1.5 rounded-lg"><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(book)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg" title="Edit Judul"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(book)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Hapus Kitab"><Trash2 size={16} /></button>
                        <button onClick={() => onSelectBook(book)} className="text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 p-1.5 rounded-lg" title="Lihat Isi"><Eye size={16} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} limit={limit} onLimitChange={(l: any) => { setLimit(l); setPage(1); load(1, query, l); }} onChange={(p: number) => load(p, query, limit)} loading={loading} />
    </div>
  );
};

// ==================== PAGES VIEW ====================
const PagesView = ({ token, onLogout, book, onEditPage }: { token: string, onLogout: () => void, book: Book, onEditPage: (p: PageRow) => void }) => {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.id === item.id)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.id === s.id)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.id !== item.id));
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);

  const load = useCallback(async (p = 1, l = limit) => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getAdminBookPages(token, book.bkid, p, l), onLogout, setError);
    if (res) { setPages(res.data); setTotal(res.total); setPage(res.page); }
    setLoading(false);
  }, [token, book.bkid, limit]);

  useEffect(() => { load(1, limit); }, [book.bkid]);

  const handleDeletePage = async (pg: PageRow) => {
    if (!confirm(`Hapus halaman Juz ${pg.part} Hal ${pg.page}?`)) return;
    const res = await adminFetch(token, () => webAPI.deleteAdminPage(token, book.bkid, pg.id), onLogout, setError);
    if (res?.success) load(page);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b bg-gray-50/50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
          <FileText size={18} className="text-[var(--app-primary)]" />
          <span dir="auto" style={{ fontFamily: 'var(--arabic-font)' }} className="text-base">{book.bk}</span>
          <span className="text-gray-400 font-normal">({total} halaman)</span>
        </h2>
      </div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'pagesview_export.csv')} />
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b">
            <tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={pages.length > 0 && pages.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, pages)} /></th><th className="px-4 py-3 w-16">Juz</th><th className="px-4 py-3 w-16">Hal</th><th className="px-4 py-3">Pratinjau Isi</th><th className="px-4 py-3 w-24 text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">Memuat...</td></tr>
            ) : pages.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">Tidak ada halaman</td></tr>
            ) : pages.map(pg => (
              <tr key={pg.id} className="hover:bg-gray-50/50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.id === pg.id)} onChange={(e) => toggleOne(e, pg)} onClick={(e) => e.stopPropagation()} /></td>
                <td className="px-4 py-3 text-gray-600 font-semibold text-sm text-center">{pg.part}</td>
                <td className="px-4 py-3 text-gray-600 text-sm text-center">{pg.page}</td>
                <td className="px-4 py-3">
                  <div className="text-gray-600 text-sm truncate max-w-xs" dir="auto" style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}>
                    {pg.preview?.replace(/\n/g, ' ')?.substring(0, 100) || '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => onEditPage(pg)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg" title="Edit Isi"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeletePage(pg)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Hapus Halaman"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} limit={limit} onLimitChange={(l: any) => { setLimit(l); setPage(1); load(1, l); }} onChange={(p: number) => load(p, limit)} loading={loading} />
    </div>
  );
};

// ==================== EDIT PAGE VIEW ====================
const EditPageView = ({ token, onLogout, book, pageRow, onSaved }: { token: string, onLogout: () => void, book: Book, pageRow: PageRow, onSaved: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nass, setNass] = useState('');
  const [part, setPart] = useState(pageRow.part);
  const [pageno, setPageno] = useState(pageRow.page);

  useEffect(() => {
    const fetch = async () => {
      const res = await adminFetch(token, () => webAPI.getAdminPage(token, book.bkid, pageRow.id), onLogout, setError);
      if (res) setNass(res.data.nass || '');
      setLoading(false);
    };
    fetch();
  }, [pageRow.id]);

  const handleSave = async () => {
    setSaving(true);
    const res = await adminFetch(token, () => webAPI.updateAdminPage(token, book.bkid, pageRow.id, { nass, part, page: pageno }), onLogout, setError);
    if (res?.success) onSaved();
    setSaving(false);
  };

  if (loading) return <div className="p-16 text-center text-gray-400">Memuat konten halaman...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b bg-gray-50/50 flex flex-col md:flex-row gap-3 justify-between items-center">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
          <Edit2 size={18} className="text-[var(--app-primary)]" />
          Edit Halaman — Juz {pageRow.part}, Hal {pageRow.page}
        </h2>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">Juz:</label>
            <input type="number" value={part} onChange={e => setPart(+e.target.value)} className="border rounded-lg px-2 py-1 w-16 focus:outline-none focus:border-[var(--app-primary)]" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">Hal:</label>
            <input type="number" value={pageno} onChange={e => setPageno(+e.target.value)} className="border rounded-lg px-2 py-1 w-16 focus:outline-none focus:border-[var(--app-primary)]" />
          </div>
        </div>
      </div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      <div className="p-4">
        <div className="text-xs text-gray-500 mb-2 text-right">Isi konten halaman (nass) — {nass.length} karakter</div>
        <textarea
          value={nass}
          onChange={e => setNass(e.target.value)}
          dir="rtl"
          rows={20}
          className="w-full border-2 border-gray-200 rounded-xl p-4 text-right text-lg leading-loose focus:outline-none focus:border-[var(--app-primary)] resize-y"
          style={{ fontFamily: 'var(--arabic-font)', lineHeight: '2.2' }}
          placeholder="Isi konten halaman..."
        />
      </div>
      <div className="p-4 border-t flex justify-end gap-3">
        <button onClick={onSaved} className="px-6 py-2 border rounded-xl text-gray-600 hover:bg-gray-50 font-semibold">Batal</button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-[var(--app-primary)] text-white rounded-xl font-bold hover:bg-[var(--app-primary-hover)] disabled:opacity-50 flex items-center gap-2">
          {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan Perubahan</>}
        </button>
      </div>
    </div>
  );
};


// ==================== FEEDBACK VIEW ====================
const FeedbackView = ({ token, onLogout }: { token: string, onLogout: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.id === item.id)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.id === s.id)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.id !== item.id));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getFeedback(token), onLogout, setError);
    if (res) setData(res.data || []);
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus feedback ini?')) return;
    const res = await adminFetch(token, () => webAPI.deleteFeedback(token, id), onLogout, setError);
    if (res && res.success) load();
  };

  const paginated = data.slice((currentPage - 1) * limit, currentPage * limit);
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gray-50 font-bold flex items-center gap-2"><MessageSquare size={18} className="text-gray-500" /> Feedback Pengguna</div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      {loading ? <div className="p-8 text-center text-gray-500">Memuat...</div> : ( <>
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'feedbackview_export.csv')} />
      <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={data.length > 0 && data.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, data)} /></th><th className="p-3">Waktu</th><th className="p-3">Email</th><th className="p-3">Rating</th><th className="p-3">Pesan</th><th className="p-3 text-center">Aksi</th></tr></thead>
            <tbody>
              {paginated.map(d => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.id === d.id)} onChange={(e) => toggleOne(e, d)} onClick={(e) => e.stopPropagation()} /></td>
                  <td className="p-3 whitespace-nowrap">{new Date((d.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}</td>
                  <td className="p-3">{d.email}</td>
                  <td className="p-3 font-bold text-amber-500">{d.rating}/5</td>
                  <td className="p-3 min-w-[300px]">{d.message}</td>
                  <td className="p-3 text-center"><button onClick={() => handleDelete(d.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus"><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada feedback.</td></tr>}
            </tbody>
          </table>
        </div>
      </>
      )}
    
      <Pagination page={currentPage} total={data.length} limit={limit} onLimitChange={(l: any) => { setLimit(l); setCurrentPage(1); }} onChange={(p: number) => setCurrentPage(p)} loading={loading} />
    </div>
  );
};

// ==================== REQUESTS VIEW ====================
const RequestsView = ({ token, onLogout }: { token: string, onLogout: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.id === item.id)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.id === s.id)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.id !== item.id));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getBookRequests(token), onLogout, setError);
    if (res) setData(res.data || []);
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus request ini?')) return;
    const res = await adminFetch(token, () => webAPI.deleteBookRequest(token, id), onLogout, setError);
    if (res && res.success) load();
  };
  const handleStatus = async (id: number, status: string) => {
    const res = await adminFetch(token, () => webAPI.updateBookRequestStatus(token, id, status), onLogout, setError);
    if (res && res.success) load();
  };

  const paginated = data.slice((currentPage - 1) * limit, currentPage * limit);
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gray-50 font-bold flex items-center gap-2"><BookPlus size={18} className="text-gray-500" /> Request Kitab</div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      {loading ? <div className="p-8 text-center text-gray-500">Memuat...</div> : ( <>
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'requestsview_export.csv')} />
      <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={data.length > 0 && data.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, data)} /></th><th className="p-3">Waktu</th><th className="p-3">Pengusul</th><th className="p-3">Judul Kitab</th><th className="p-3">Keterangan</th><th className="p-3">Status</th><th className="p-3 text-center">Aksi</th></tr></thead>
            <tbody>
              {paginated.map(d => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.id === d.id)} onChange={(e) => toggleOne(e, d)} onClick={(e) => e.stopPropagation()} /></td>
                  <td className="p-3 whitespace-nowrap">{new Date((d.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}</td>
                  <td className="p-3">{d.email}<br/><span className="text-gray-400 text-xs">{d.name}</span></td>
                  <td className="p-3 font-semibold">{d.book_title}<br/><span className="text-gray-500 font-normal">{d.book_author}</span></td>
                  <td className="p-3 min-w-[200px]">{d.notes}</td>
                  <td className="p-3">
                    <select value={d.status || 'pending'} onChange={(e) => handleStatus(d.id, e.target.value)} className="border rounded p-1 text-xs">
                      <option value="pending">Pending</option>
                      <option value="approved">Disetujui</option>
                      <option value="rejected">Ditolak</option>
                    </select>
                  </td>
                  <td className="p-3 text-center"><button onClick={() => handleDelete(d.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">Belum ada request.</td></tr>}
            </tbody>
          </table>
        </div>
      </>
      )}
    
      <Pagination page={currentPage} total={data.length} limit={limit} onLimitChange={(l: any) => { setLimit(l); setCurrentPage(1); }} onChange={(p: number) => setCurrentPage(p)} loading={loading} />
    </div>
  );
};

// ==================== SUBMISSIONS VIEW ====================
const SubmissionsView = ({ token, onLogout }: { token: string, onLogout: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.id === item.id)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.id === s.id)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.id !== item.id));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getBookSubmissions(token), onLogout, setError);
    if (res) setData(res.data || []);
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus kiriman ini?')) return;
    const res = await adminFetch(token, () => webAPI.deleteBookSubmission(token, id), onLogout, setError);
    if (res && res.success) load();
  };
  const handleStatus = async (id: number, status: string) => {
    const res = await adminFetch(token, () => webAPI.updateBookSubmissionStatus(token, id, status), onLogout, setError);
    if (res && res.success) load();
  };

  const paginated = data.slice((currentPage - 1) * limit, currentPage * limit);
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gray-50 font-bold flex items-center gap-2"><Upload size={18} className="text-gray-500" /> Submit Kitab (File)</div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      {loading ? <div className="p-8 text-center text-gray-500">Memuat...</div> : ( <>
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'submissionsview_export.csv')} />
      <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={paginated.length > 0 && paginated.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, paginated)} /></th><th className="p-3">Waktu</th><th className="p-3">Pengirim</th><th className="p-3">Judul Kitab</th><th className="p-3">File</th><th className="p-3">Status</th><th className="p-3 text-center">Aksi</th></tr></thead>
            <tbody>
              {paginated.map(d => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.id === d.id)} onChange={(e) => toggleOne(e, d)} onClick={(e) => e.stopPropagation()} /></td>
                  <td className="p-3 whitespace-nowrap">{new Date((d.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}</td>
                  <td className="p-3">{d.email}<br/><span className="text-gray-400 text-xs">{d.name}</span></td>
                  <td className="p-3 font-semibold">{d.book_title}<br/><span className="text-gray-500 font-normal">{d.book_author}</span></td>
                  <td className="p-3">
                    {d.file_name ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs max-w-[150px] truncate" title={d.file_name}>{d.file_name}</span>
                        <a href={`/uploads/${(d.file_path || '').split(/\\|\//).pop()}`} target="_blank" rel="noreferrer" className="text-[var(--app-primary)] hover:underline flex items-center gap-1 text-xs"><Upload size={12}/> Unduh</a>
                      </div>
                    ) : <span className="text-gray-400 italic">Tanpa File</span>}
                  </td>
                  <td className="p-3">
                    <select value={d.status || 'pending'} onChange={(e) => handleStatus(d.id, e.target.value)} className="border rounded p-1 text-xs">
                      <option value="pending">Pending</option>
                      <option value="approved">Disetujui</option>
                      <option value="rejected">Ditolak</option>
                    </select>
                  </td>
                  <td className="p-3 text-center"><button onClick={() => handleDelete(d.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">Belum ada kiriman file.</td></tr>}
            </tbody>
          </table>
        </div>
      </>
      )}
    
      <Pagination page={currentPage} total={data.length} limit={limit} onLimitChange={(l: any) => { setLimit(l); setCurrentPage(1); }} onChange={(p: number) => setCurrentPage(p)} loading={loading} />
    </div>
  );
};


// ==================== LOGS VIEW ====================
const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: () => void, type: string, title: string }) => {
  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const toggleAll = (e: any, list: any[]) => {
    if (e.target.checked) {
      const newSel = [...selected];
      list.forEach(item => { if (!newSel.find(s => s.id === item.id)) newSel.push(item); });
      setSelected(newSel);
    } else {
      setSelected(selected.filter(s => !list.find(item => item.id === s.id)));
    }
  };
  const toggleOne = (e: any, item: any) => {
    if (e.target.checked) setSelected([...selected, item]);
    else setSelected(selected.filter(s => s.id !== item.id));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [stats, setStats] = useState({ daily: 0, weekly: 0, monthly: 0 });

  useEffect(() => {
    if (data && data.length > 0) {
      const now = new Date();
      // Reset time to 00:00:00 for accurate local date boundaries
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let d = 0, w = 0, m = 0;
      data.forEach(item => {
        const itemDateStr = (item.created_at || '').replace(' ', 'T');
        if (!itemDateStr) return;
        // Parse as UTC (database format) to local Date object
        const itemDate = new Date(itemDateStr + 'Z');
        
        if (itemDate >= startOfToday) d++;
        if (itemDate >= startOfWeek) w++;
        if (itemDate >= startOfMonth) m++;
      });
      setStats({ daily: d, weekly: w, monthly: m });
    } else {
      setStats({ daily: 0, weekly: 0, monthly: 0 });
    }
  }, [data]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await adminFetch(token, () => webAPI.getAdminLogs(token, type), onLogout, setError);
      if (res) setData(res);
      setLoading(false);
    };
    load();
  }, [token, type]);

  const paginated = data.slice((currentPage - 1) * limit, currentPage * limit);
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gray-50 font-bold text-gray-800">{title}</div>
      
      {/* Infografis Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-4 p-4 rounded-xl border shadow-sm bg-blue-50/50">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Activity size={24} /></div>
          <div><div className="text-sm text-gray-500 font-medium">Hari Ini</div><div className="text-2xl font-bold text-gray-800">{stats.daily}</div></div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-xl border shadow-sm bg-green-50/50">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg"><Calendar size={24} /></div>
          <div><div className="text-sm text-gray-500 font-medium">Minggu Ini</div><div className="text-2xl font-bold text-gray-800">{stats.weekly}</div></div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-xl border shadow-sm bg-purple-50/50">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><BarChart2 size={24} /></div>
          <div><div className="text-sm text-gray-500 font-medium">Bulan Ini</div><div className="text-2xl font-bold text-gray-800">{stats.monthly}</div></div>
        </div>
      </div>

      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'logsview_export.csv')} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={paginated.length > 0 && paginated.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, paginated)} /></th>
              <th className="p-3 w-16">ID</th>
              <th className="p-3 w-48">Waktu</th>
              <th className="p-3">Data</th>
              <th className="p-3 w-32">IP Address</th>
              <th className="p-3 w-48 hidden md:table-cell">Perangkat / Browser</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Memuat...</td></tr> : 
              data.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Belum ada log</td></tr> :
              paginated.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                <td className="p-3 text-center"><input type="checkbox" checked={!!selected.find(s => s.id === d.id)} onChange={(e) => toggleOne(e, d)} onClick={(e) => e.stopPropagation()} /></td>
                  <td className="p-3 text-gray-500">{d.id}</td>
                  <td className="p-3 whitespace-nowrap text-gray-600">{new Date((d.created_at || '').replace(' ', 'T') + 'Z').toLocaleString('id-ID')}</td>
                  <td className="p-3 font-medium">
                    {type === 'search' && <span>{d.query}</span>}
                    {type === 'download' && (() => {
                      let t = d.book_title || '';
                      let badge = 'Kitab (Word)';
                      let badgeColor = 'bg-green-100 text-green-800';
                      let idText = d.book_id ? ` (ID: ${d.book_id})` : '';
                      
                      if (t.startsWith('[PDF Scholarium] ')) {
                        badge = 'Scholarium (PDF)';
                        badgeColor = 'bg-yellow-100 text-yellow-800';
                        t = t.replace('[PDF Scholarium] ', '');
                        idText = '';
                      } else if (t.startsWith('[PDF Archive] ')) {
                        badge = 'Archive (PDF)';
                        badgeColor = 'bg-blue-100 text-blue-800';
                        t = t.replace('[PDF Archive] ', '');
                        idText = '';
                      }
                      return (
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${badgeColor} whitespace-nowrap`}>{badge}</span>
                          <span>{t}{idText}</span>
                        </div>
                      );
                    })()}
                    {type === 'visit' && <span>Path: {d.path}</span>}
                    {type === 'quran' && <span>Surah ID: {d.surah_id}</span>}
                    {type === 'rowa' && <span>{d.rowa_name} (ID: {d.rowa_id})</span>}
                    {type === 'ask' && (
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-blue-600">Q: {d.question}</span>
                        <span className="text-gray-500 text-xs truncate max-w-md">A: {d.response}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-500">{d.ip || '-'}</td>
                  <td className="p-3 text-xs text-gray-500 max-w-[200px] truncate hidden md:table-cell" title={d.user_agent || ''}>
                    {d.user_agent || '-'}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    
      <Pagination page={currentPage} total={data.length} limit={limit} onLimitChange={(l: any) => { setLimit(l); setCurrentPage(1); }} onChange={(p: number) => setCurrentPage(p)} loading={loading} />
    </div>
  );
};

// ==================== DASHBOARD ====================

const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: () => void, onClose: () => void }) => {
  const [view, setView] = useState<AdminView>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageRow | null>(null);
  const [stats, setStats] = useState<any>({});

  const fetchStats = useCallback(() => {
    adminFetch(token, () => webAPI.getAdminStats(token), onLogout, () => {}).then(res => {
      if (res && res.data) setStats(res.data);
    });
  }, [token, onLogout]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const breadcrumb = [
    { label: view.startsWith('log_') ? 'Logs' : view === 'feedback' ? 'Feedback' : view === 'requests' ? 'Request Kitab' : view === 'submissions' ? 'Submit Kitab' : 'Database Kitab', onClick: () => { setView(view.startsWith('log_') ? view : view === 'feedback' ? 'feedback' : view === 'requests' ? 'requests' : view === 'submissions' ? 'submissions' : 'categories'); setSelectedCategory(null); setSelectedBook(null); setSelectedPage(null); } },
    ...(!view.startsWith('log_') && view !== 'feedback' && view !== 'requests' && view !== 'submissions' && selectedCategory ? [{ label: selectedCategory.name, onClick: () => { setView('books'); setSelectedBook(null); setSelectedPage(null); } }] : []),
    ...(!view.startsWith('log_') && view !== 'feedback' && view !== 'requests' && view !== 'submissions' && selectedBook ? [{ label: selectedBook.bk, onClick: () => { setView('pages'); setSelectedPage(null); } }] : []),
    ...(!view.startsWith('log_') && view !== 'feedback' && view !== 'requests' && view !== 'submissions' && selectedPage ? [{ label: `Juz ${selectedPage.part} Hal ${selectedPage.page}`, onClick: () => {} }] : []),
  ];

  const goBack = () => {
    if (view === 'edit_page') { setView('pages'); setSelectedPage(null); }
    else if (view === 'pages') { setView('books'); setSelectedBook(null); }
    else if (view === 'books') { setView('categories'); setSelectedCategory(null); }
  };

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col z-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          {view !== 'categories' && (
            <button onClick={goBack} className="text-gray-500 hover:text-[var(--app-primary)] p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
                <button onClick={b.onClick} className={`font-semibold transition-colors max-w-[200px] truncate ${i === breadcrumb.length - 1 ? 'text-[var(--app-primary)]' : 'text-gray-500 hover:text-gray-800'}`} dir="auto" style={i > 0 ? { fontFamily: 'var(--arabic-font)' } : {}}>
                  {b.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onLogout} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Logout"><LogOut size={18} /></button>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">Tutup</button>
        </div>
      </div>

      
      {/* Sub Navigation */}
      <div className="bg-white border-b px-6 flex gap-4 overflow-x-auto shadow-sm">
        <button onClick={() => { setView('categories'); setSelectedCategory(null); setSelectedBook(null); setSelectedPage(null); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${['categories', 'books', 'pages', 'edit_page'].includes(view) ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Database Kitab {stats.books !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ ['categories', 'books', 'pages', 'edit_page'].includes(view) ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.books}</span>}</button>
        <button onClick={() => { setView('feedback'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'feedback' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Feedback {stats.feedback !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'feedback' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.feedback}</span>}</button>
        <button onClick={() => { setView('requests'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'requests' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Request Kitab {stats.requests !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'requests' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.requests}</span>}</button>
        <button onClick={() => { setView('submissions'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'submissions' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Submit Kitab {stats.submissions !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'submissions' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.submissions}</span>}</button>
      
        <button onClick={() => { setView('log_search'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'log_search' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Log Pencarian {stats.log_search !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'log_search' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.log_search}</span>}</button>
        <button onClick={() => { setView('log_download'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'log_download' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Log Download {stats.log_download !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'log_download' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.log_download}</span>}</button>
        <button onClick={() => { setView('log_visit'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'log_visit' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Log Kunjungan {stats.log_visit !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'log_visit' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.log_visit}</span>}</button>
        <button onClick={() => { setView('log_quran'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'log_quran' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Log Qur'an {stats.log_quran !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'log_quran' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.log_quran}</span>}</button>
        <button onClick={() => { setView('log_rowa'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'log_rowa' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Log Perawi {stats.log_rowa !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'log_rowa' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.log_rowa}</span>}</button>
        <button onClick={() => { setView('log_ask'); }} className={`py-3 font-semibold text-sm border-b-2 flex items-center whitespace-nowrap transition-colors ${view === 'log_ask' ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Log Tanya AI {stats.log_ask !== undefined && <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ view === 'log_ask' ? 'bg-[var(--app-primary)] text-white' : 'bg-gray-100 text-gray-600' }`}>{stats.log_ask}</span>}</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          {view === 'categories' && (
            <CategoriesView token={token} onLogout={onLogout} onSelectCategory={(cat) => { setSelectedCategory(cat); setView('books'); }} />
          )}
          {view === 'books' && selectedCategory && (
            <BooksView token={token} onLogout={onLogout} category={selectedCategory} onSelectBook={(book) => { setSelectedBook(book); setView('pages'); }} />
          )}
          {view === 'pages' && selectedBook && (
            <PagesView token={token} onLogout={onLogout} book={selectedBook} onEditPage={(pg) => { setSelectedPage(pg); setView('edit_page'); }} />
          )}
          {view === 'edit_page' && selectedBook && selectedPage && (
            <EditPageView token={token} onLogout={onLogout} book={selectedBook} pageRow={selectedPage} onSaved={() => { setView('pages'); setSelectedPage(null); }} />
          )}
          {view === 'feedback' && <FeedbackView token={token} onLogout={onLogout} />}
          {view === 'requests' && <RequestsView token={token} onLogout={onLogout} />}
                    {view === 'submissions' && <SubmissionsView token={token} onLogout={onLogout} />}
          {view === 'log_search' && <LogsView token={token} onLogout={onLogout} type="search" title="Log Pencarian" />}
          {view === 'log_download' && <LogsView token={token} onLogout={onLogout} type="download" title="Log Download" />}
          {view === 'log_visit' && <LogsView token={token} onLogout={onLogout} type="visit" title="Log Kunjungan Halaman" />}
          {view === 'log_quran' && <LogsView token={token} onLogout={onLogout} type="quran" title="Log Penggunaan Al Qur'an" />}
          {view === 'log_rowa' && <LogsView token={token} onLogout={onLogout} type="rowa" title="Log Kamus Perawi" />}
          {view === 'log_ask' && <LogsView token={token} onLogout={onLogout} type="ask" title="Log Tanya AI" />}
        </div>
      </div>
    </div>
  );
}
;

// ==================== MAIN EXPORT ====================
export const Admin = ({ onClose }: { onClose: () => void }) => {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');

  if (!token) {
    return <LoginForm onLogin={(t) => { setToken(t); localStorage.setItem('adminToken', t); }} onClose={onClose} />;
  }
  return <AdminDashboard token={token} onLogout={() => { setToken(''); localStorage.removeItem('adminToken'); }} onClose={onClose} />;
};
