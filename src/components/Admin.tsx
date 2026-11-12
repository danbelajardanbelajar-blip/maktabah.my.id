import { pushLocation } from '../lib/back-navigation';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { webAPI } from '../api';
import { BookTransfer } from './BookTransfer';
import { RowaDatabase } from './RowaDatabase';
import { AiSettings } from './AiSettings';
import { useModalFocus } from '../lib/use-modal-focus';
import { adminParent, adminTitle, adminGroup, adminLocation } from '../lib/admin-navigation';
import { AdminNavigation } from './AdminNavigation';
import { restoreAdminEntities } from '../lib/admin-loader';
import { StorageCleanup } from './StorageCleanup';
import { BackButton } from './BackButton';
import { navigationHash, parseNavigation, routePage } from '../lib/navigation';
import type { AdminView } from '../lib/admin-navigation';
import { LogIn, Edit2, Trash2, Save, X, Search, ChevronLeft, ChevronRight, LogOut, FolderOpen, BookOpen, FileText, Eye, AlertTriangle, MessageSquare, BookPlus, Upload, Download, FolderSync, Activity, Calendar, BarChart2, CheckCircle2, Loader2, GitMerge, Layers, Star, ThumbsUp, Clock, XCircle, Hash, Folder } from 'lucide-react';
import { CategoryMergeModal } from './CategoryMergeModal';

// ==================== TYPES ====================
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
    <div className="bg-[var(--app-primary)] text-white px-4 py-3 flex flex-wrap gap-3 items-center justify-between mb-4 rounded-xl shadow-md">
      <span className="font-bold">{count} item dipilih</span>
      <div className="flex flex-wrap gap-2">
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
  const dialogRef = useModalFocus(onClose);
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
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Login administrator" tabIndex={-1} className="fixed inset-0 bg-black/50 flex justify-center items-center z-[80] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative">
        <div className="px-6 pt-5"><BackButton onClick={onClose} title="Kembali ke beranda"/></div>
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

// Keep deletion feedback visible even when the deleted row disappears or the user has scrolled.
const useDeletionFeedback = (token: string, onLogout: () => void, setError: (message: string) => void, onRecovered: () => void) => {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'pending' | 'success' | 'error'; message: string } | null>(null);
  const run = async (action: (onProgress: (message: string) => void) => Promise<any>, message: (result: any) => string, onSuccess: () => void) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError('');
    setNotice({ kind: 'pending', message: 'Sedang menghapus data. Mohon tunggu…' });
    let result;
    try {
      result = await action(message => setNotice({ kind: 'pending', message }));
      if (!result?.success) throw new Error(result?.error || 'Server belum mengonfirmasi penghapusan.');
    } catch (error: any) {
      const message = error.message === '401' ? 'Sesi berakhir. Silakan masuk kembali.' : error.message || 'Penghapusan tidak berhasil dikonfirmasi. Silakan periksa koneksi dan muat ulang daftar.';
      setError(message);
      setNotice({ kind: 'error', message });
      if (error.message === '401') onLogout();
      return;
    } finally {
      locked.current = false;
      setPending(false);
    }
    setNotice({ kind: 'success', message: message(result) });
    onSuccess();
  };
  const recoveryCallback = useRef(onRecovered);
  recoveryCallback.current = onRecovered;
  useEffect(() => {
    let disposed = false;
    webAPI.resumeDeletion(token, message => {
      if (!disposed) { locked.current = true; setPending(true); setNotice({ kind: 'pending', message }); }
    }).then(result => {
      if (!disposed && result) {
        setNotice({ kind: 'success', message: `Penghapusan selesai: ${result.deleted.books} kitab, ${result.deleted.pages} halaman, dan ${result.deleted.titles} entri daftar isi dihapus.` });
        recoveryCallback.current();
      }
    }).catch(error => {
      if (!disposed) { setNotice({ kind: 'error', message: error.message }); if (error.message === '401') onLogout(); }
    }).finally(() => { if (!disposed) { locked.current = false; setPending(false); } });
    return () => { disposed = true; };
  }, [token]);
  const feedback = notice && (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl" aria-live="polite" aria-atomic="true">
      <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${notice.kind === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : notice.kind === 'error' ? 'bg-red-50 border-red-300 text-red-900' : 'bg-blue-50 border-blue-300 text-blue-900'}`}>
        {notice.kind === 'pending' ? <Loader2 className="animate-spin shrink-0" size={22} /> : notice.kind === 'success' ? <CheckCircle2 className="shrink-0" size={22} /> : <AlertTriangle className="shrink-0" size={22} />}
        <p className="flex-1 text-sm font-semibold break-words">{notice.message}</p>
        {notice.kind !== 'pending' && <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan" className="p-1 rounded hover:bg-black/5"><X size={18} /></button>}
      </div>
    </div>
  );
  return { pending, run, feedback };
};

// ==================== CATEGORIES VIEW ====================
const CategoriesView = ({ token, onLogout, onSelectCategory, onChanged }: { token: string, onLogout: () => void, onSelectCategory: (cat: Category) => void, onChanged: () => void }) => {
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

  const [currentPage, setCurrentPage] = useState(() => routePage(parseNavigation(window.location.hash).params.get('cpage')));
  const [limit, setLimit] = useState(() => {const n=Number(parseNavigation(window.location.hash).params.get('csize')); return [15,20,25,30,50,100,500].includes(n)?n:15;});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deletion = useDeletionFeedback(token, onLogout, setError, () => { load(); onChanged(); });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [query, setQuery] = useState(() => parseNavigation(window.location.hash).params.get('cq') || '');
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState('');
  useEffect(() => {
    const current=parseNavigation(window.location.hash);
    if (current.tab !== 'admin' || adminLocation(window.location.hash).view !== 'categories') return;
    current.params.set('cpage',String(currentPage)); current.params.set('csize',String(limit)); current.params.set('cq',query);
    window.history.replaceState(window.history.state,'',`#/admin?${current.params}`);
  },[currentPage,limit,query]);

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
    if (deletion.pending) return;
    if (!confirm(`Hapus kategori "${cat.name}" beserta seluruh ${cat.book_count} kitab di dalamnya? Semua teks halaman, daftar isi, dan relasi kitab akan dihapus. Tindakan ini tidak dapat dibatalkan.`)) return;
    await deletion.run(progress => webAPI.deleteAdminCategory(token, cat.id, progress),
      res => `Kategori "${cat.name}" berhasil dihapus beserta ${res.deleted.books} kitab, ${res.deleted.pages} halaman, dan ${res.deleted.titles} entri daftar isi.`,
      () => { setSelected(items => items.filter(item => item.id !== cat.id)); load(); onChanged(); });
  };

  const paginated = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const handleBulkDelete = async () => {
    if (deletion.pending || !selected.length) return;
    const ids = selected.map(item => item.id);
    const bookCount = selected.reduce((count, item) => count + item.book_count, 0);
    if (!window.confirm(`Hapus ${ids.length} kategori terpilih beserta seluruh ${bookCount} kitab di dalamnya? Semua teks halaman, daftar isi, dan relasi kitab ikut dihapus. Tindakan ini tidak dapat dibatalkan.`)) return;
    await deletion.run(progress => webAPI.bulkDeleteCategories(token, ids, progress),
      res => `${res.deleted.categories} kategori berhasil dihapus beserta ${res.deleted.books} kitab, ${res.deleted.pages} halaman, dan ${res.deleted.titles} entri daftar isi.`,
      () => { setSelected([]); setCurrentPage(1); load(); onChanged(); });
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {deletion.feedback}
      <div className="p-5 border-b bg-gray-50/50 flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><FolderOpen size={20} className="text-[var(--app-primary)]" /> Kategori ({cats.length})</h2>
          <button onClick={() => setMergeModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm" title="Gabungkan banyak kategori yang sama / serupa">
            <GitMerge size={15} /> Gabung Kategori
          </button>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => {setQuery(e.target.value);setCurrentPage(1);}} placeholder="Cari kategori..." className="pl-9 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:border-[var(--app-primary)] text-sm" />
        </div>
      </div>
      {/* Infografis Statistik Kategori & Kitab */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-emerald-50/50 border-emerald-100">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg"><FolderOpen size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Total Kategori</div><div className="text-xl font-bold text-gray-800">{cats.length.toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-blue-50/50 border-blue-100">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg"><BookOpen size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Total Kitab</div><div className="text-xl font-bold text-gray-800">{cats.reduce((acc, c) => acc + (c.book_count || 0), 0).toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-purple-50/50 border-purple-100">
          <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg"><BarChart2 size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Rata-rata Kitab / Kat.</div><div className="text-xl font-bold text-gray-800">{Math.round(cats.reduce((acc, c) => acc + (c.book_count || 0), 0) / (cats.length || 1)).toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-amber-50/50 border-amber-100">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg"><Folder size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Kategori Terisi</div><div className="text-xl font-bold text-gray-800">{cats.filter(c => c.book_count > 0).length} <span className="text-xs font-normal text-gray-500">({cats.filter(c => !c.book_count || c.book_count === 0).length} kosong)</span></div></div>
        </div>
      </div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      {mergeSuccessMsg && (
        <div className="mx-5 mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-medium">{mergeSuccessMsg}</span>
          </div>
          <button onClick={() => setMergeSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 p-1"><X size={16} /></button>
        </div>
      )}
      
      <p className="px-5 py-2 text-xs text-gray-500">Checkbox judul tabel memilih kategori pada halaman ini.{selected.length > 0 && ` ${selected.length} kategori dipilih, termasuk ${selected.filter(item => !paginated.some(c => c.id === item.id)).length} di luar halaman ini.`}</p>
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'categoriesview_export.csv')} extraActions={
        <>
          {filtered.some(cat => !selected.some(item => item.id === cat.id)) && filtered.length > paginated.length && <button disabled={deletion.pending} onClick={() => setSelected(current => [...current, ...filtered.filter(cat => !current.some(item => item.id === cat.id))])} className="bg-white/15 px-3 py-1.5 rounded text-sm font-bold disabled:opacity-40">Pilih semua {filtered.length} hasil</button>}
          <button onClick={() => setMergeModalOpen(true)} disabled={deletion.pending} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded font-bold text-sm flex items-center gap-1.5 shadow-xs"><GitMerge size={16} /> Gabungkan ({selected.length})</button>
          <button onClick={handleBulkDelete} disabled={deletion.pending} className="bg-red-600 text-white px-3 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-red-700 disabled:opacity-40 disabled:cursor-wait"><Trash2 size={16} />{deletion.pending ? 'Menghapus…' : 'Hapus terpilih'}</button>
          <button onClick={() => setSelected([])} disabled={deletion.pending} className="bg-white/15 text-white px-3 py-1.5 rounded font-bold text-sm disabled:opacity-40">Batalkan pilihan</button>
        </>
      } />
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b">
            <tr><th className="p-3 w-10 text-center"><input type="checkbox" disabled={deletion.pending} aria-label="Pilih semua kategori di halaman ini" checked={paginated.length > 0 && paginated.every((item: any) => selected.find((s: any) => s.id === item.id))} onChange={(e) => toggleAll(e, paginated)} /></th><th className="px-4 py-3 w-12">ID</th><th className="px-4 py-3">Nama Kategori</th><th className="px-4 py-3 w-20 text-center">Kitab</th><th className="px-4 py-3 w-28 text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Tidak ada kategori</td></tr>
            ) : paginated.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50/50">
                <td className="p-3 text-center"><input type="checkbox" disabled={deletion.pending} aria-label={`Pilih kategori ${cat.name}`} checked={!!selected.find(s => s.id === cat.id)} onChange={(e) => toggleOne(e, cat)} onClick={(e) => e.stopPropagation()} /></td>
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
                        <button onClick={() => handleDelete(cat)} disabled={deletion.pending} className="disabled:opacity-40 disabled:cursor-wait text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Hapus"><Trash2 size={16} /></button>
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
      <CategoryMergeModal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        categories={cats}
        initialSelected={selected}
        token={token}
        onMerged={(msg) => {
          setMergeSuccessMsg(msg);
          setSelected([]);
          load();
          onChanged();
          setTimeout(() => setMergeSuccessMsg(''), 8000);
        }}
        onLogout={onLogout}
      />
    </div>
  );
};

// ==================== BOOKS VIEW ====================
const BooksView = ({ token, onLogout, category, onSelectBook, onChanged }: { token: string, onLogout: () => void, category: Category, onSelectBook: (book: Book) => void, onChanged: () => void }) => {
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
    if (deletion.pending) return;
    if (!window.confirm(`Hapus ${selected.length} kitab beserta seluruh teks halaman, daftar isi, dan relasinya? Tindakan ini tidak dapat dibatalkan.`)) return;
    const ids = selected.map(s => s.bkid);
    await deletion.run(progress => webAPI.bulkDeleteBooks(token, ids, progress),
      res => `${res.deleted.books} kitab berhasil dihapus beserta ${res.deleted.pages} halaman dan ${res.deleted.titles} entri daftar isi.`,
      () => { setSelected([]); load(); onChanged(); });
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
  const deletion = useDeletionFeedback(token, onLogout, setError, () => { load(); onChanged(); });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [query, setQuery] = useState(() => parseNavigation(window.location.hash).params.get('bq') || '');
  const [page, setPage] = useState(() => routePage(parseNavigation(window.location.hash).params.get('bpage')));
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(() => { const n = Number(parseNavigation(window.location.hash).params.get('bsize')); return [15,20,25,30,50,100,500].includes(n)?n:30; });

  const load = useCallback(async (p = 1, q = query, l = limit) => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getAdminBooks(token, p, q, category.id, l), onLogout, setError);
    if (res) {
      setBooks(res.data); setTotal(res.total); setPage(res.page);
      const current = parseNavigation(window.location.hash);
      if (current.tab === 'admin' && current.params.get('view') === 'books' && Number(current.params.get('cat')) === category.id) {
        current.params.set('bq',q); current.params.set('bpage',String(res.page)); current.params.set('bsize',String(l));
        window.history.replaceState(window.history.state,'',`#/admin?${current.params}`);
      }
    }
    setLoading(false);
  }, [token, category.id, query, limit]);

  useEffect(() => { load(page, query, limit); }, [category.id]);

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
    if (deletion.pending) return;
    if (!confirm(`Hapus kitab "${book.bk}"? Seluruh teks halaman, daftar isi, dan relasinya akan dihapus. Tindakan ini tidak dapat dibatalkan.`)) return;
    await deletion.run(progress => webAPI.deleteAdminBook(token, book.bkid, progress),
      res => `Kitab "${book.bk}" berhasil dihapus beserta ${res.deleted.pages} halaman dan ${res.deleted.titles} entri daftar isi.`,
      () => { setSelected(items => items.filter(item => item.bkid !== book.bkid)); load(page); onChanged(); });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {deletion.feedback}
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
      {/* Statistik Kitab dalam Kategori */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border-b bg-white">
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-emerald-50/50 border-emerald-100">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg"><Folder size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Kategori Terpilih</div><div className="text-base font-bold text-gray-800 truncate max-w-[220px]" dir="auto">{category.name}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-blue-50/50 border-blue-100">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg"><BookOpen size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Total Kitab dalam Kategori</div><div className="text-xl font-bold text-gray-800">{total.toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-gray-50/70 border-gray-200">
          <div className="p-2.5 bg-gray-200 text-gray-700 rounded-lg"><Hash size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">ID Kategori</div><div className="text-xl font-bold text-gray-800">#{category.id}</div></div>
        </div>
      </div>
      {error && <div className="p-4"><ErrorBanner msg={error} onClose={() => setError('')} /></div>}
      
      <SelectionBar count={selected.length} onDownload={() => downloadCSV(selected, 'books_export.csv')} extraActions={
        <>
          <button onClick={() => setBulkMoveMode(true)} className="bg-yellow-500 text-white px-3 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-yellow-600 transition-colors"><FolderSync size={16}/> Pindah Kategori</button>
          <button onClick={handleBulkDelete} disabled={deletion.pending} className="disabled:opacity-40 disabled:cursor-wait bg-red-500 text-white px-3 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-red-600 transition-colors"><Trash2 size={16}/> Hapus</button>
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
                        <button onClick={() => handleDelete(book)} disabled={deletion.pending} className="disabled:opacity-40 disabled:cursor-wait text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Hapus Kitab"><Trash2 size={16} /></button>
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
  const deletion = useDeletionFeedback(token, onLogout, setError, () => { load(); });
  const [page, setPage] = useState(() => routePage(parseNavigation(window.location.hash).params.get('ppage')));
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(() => {const n=Number(parseNavigation(window.location.hash).params.get('psize')); return [15,20,25,30,50,100,500].includes(n)?n:20;});

  const load = useCallback(async (p = 1, l = limit) => {
    setLoading(true);
    const res = await adminFetch(token, () => webAPI.getAdminBookPages(token, book.bkid, p, l), onLogout, setError);
    if (res) {
      setPages(res.data); setTotal(res.total); setPage(res.page);
      const current=parseNavigation(window.location.hash);
      if (current.tab === 'admin' && current.params.get('view') === 'pages' && Number(current.params.get('book')) === book.bkid) {
        current.params.set('ppage',String(res.page)); current.params.set('psize',String(l));
        window.history.replaceState(window.history.state,'',`#/admin?${current.params}`);
      }
    }
    setLoading(false);
  }, [token, book.bkid, limit]);

  useEffect(() => { load(page, limit); }, [book.bkid]);

  const handleDeletePage = async (pg: PageRow) => {
    if (deletion.pending) return;
    if (!confirm(`Hapus halaman Juz ${pg.part} Hal ${pg.page}?`)) return;
    await deletion.run(() => webAPI.deleteAdminPage(token, book.bkid, pg.id),
      () => `Halaman Juz ${pg.part} Hal ${pg.page} berhasil dihapus.`,
      () => { setSelected(items => items.filter(item => item.id !== pg.id)); load(page); });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {deletion.feedback}
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
                    <button onClick={() => handleDeletePage(pg)} disabled={deletion.pending} className="disabled:opacity-40 disabled:cursor-wait text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Hapus Halaman"><Trash2 size={16} /></button>
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
      {/* Infografis Statistik Feedback */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-blue-50/50 border-blue-100">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg"><MessageSquare size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Total Feedback</div><div className="text-xl font-bold text-gray-800">{data.length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-amber-50/50 border-amber-100">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg"><Star size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Rating Rata-rata</div><div className="text-xl font-bold text-gray-800">{data.length ? (data.reduce((acc, d) => acc + (Number(d.rating) || 0), 0) / data.length).toFixed(1) + ' / 5' : '-'}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-emerald-50/50 border-emerald-100">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg"><ThumbsUp size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Rating Positif (4-5★)</div><div className="text-xl font-bold text-gray-800">{data.filter(d => Number(d.rating) >= 4).length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-purple-50/50 border-purple-100">
          <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg"><Calendar size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">30 Hari Terakhir</div><div className="text-xl font-bold text-gray-800">{data.filter(d => { const t = new Date((d.created_at || '').replace(' ', 'T') + 'Z').getTime(); return !isNaN(t) && t >= Date.now() - 30 * 24 * 3600 * 1000; }).length}</div></div>
        </div>
      </div>
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
      {/* Infografis Statistik Request Kitab */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-blue-50/50 border-blue-100">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg"><BookPlus size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Total Permintaan</div><div className="text-xl font-bold text-gray-800">{data.length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-amber-50/50 border-amber-100">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg"><Clock size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Menunggu (Pending)</div><div className="text-xl font-bold text-amber-800">{data.filter(d => (d.status || 'pending') === 'pending').length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-emerald-50/50 border-emerald-100">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg"><CheckCircle2 size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Disetujui</div><div className="text-xl font-bold text-emerald-800">{data.filter(d => d.status === 'approved').length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-red-50/50 border-red-100">
          <div className="p-2.5 bg-red-100 text-red-700 rounded-lg"><XCircle size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Ditolak</div><div className="text-xl font-bold text-red-800">{data.filter(d => d.status === 'rejected').length}</div></div>
        </div>
      </div>
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
      {/* Infografis Statistik Kiriman Kitab */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-blue-50/50 border-blue-100">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg"><Upload size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Total Kiriman</div><div className="text-xl font-bold text-gray-800">{data.length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-amber-50/50 border-amber-100">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg"><Clock size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Menunggu (Pending)</div><div className="text-xl font-bold text-amber-800">{data.filter(d => (d.status || 'pending') === 'pending').length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-emerald-50/50 border-emerald-100">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg"><CheckCircle2 size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Disetujui</div><div className="text-xl font-bold text-emerald-800">{data.filter(d => d.status === 'approved').length}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs bg-red-50/50 border-red-100">
          <div className="p-2.5 bg-red-100 text-red-700 rounded-lg"><XCircle size={20} /></div>
          <div><div className="text-xs text-gray-500 font-medium">Ditolak</div><div className="text-xl font-bold text-red-800">{data.filter(d => d.status === 'rejected').length}</div></div>
        </div>
      </div>
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
  
  const [stats, setStats] = useState({ total: 0, today: 0, weekly: 0, monthly: 0, unique_ips: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await adminFetch(token, () => webAPI.getAdminLogs(token, type), onLogout, setError);
      if (res) {
        if (Array.isArray(res)) {
          setData(res);
        } else if (res.data) {
          setData(res.data);
          if (res.stats) {
            setStats({
              total: Number(res.stats.total) || 0,
              today: Number(res.stats.today) || 0,
              weekly: Number(res.stats.weekly) || 0,
              monthly: Number(res.stats.monthly) || 0,
              unique_ips: Number(res.stats.unique_ips) || 0
            });
          }
        }
      }
      setLoading(false);
    };
    load();
  }, [token, type]);

  useEffect(() => {
    // Fallback hitung statistik dari data log jika server tidak mengembalikan objek stats
    if (data && data.length > 0 && stats.total === 0) {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      let d = 0, w = 0, m = 0;
      const ips = new Set<string>();

      data.forEach(item => {
        if (item.ip) ips.add(item.ip);
        const itemDateStr = (item.created_at || '').replace(' ', 'T');
        if (!itemDateStr) return;
        const itemTime = new Date(itemDateStr + 'Z').getTime();
        if (isNaN(itemTime)) return;
        
        if (itemTime >= oneDayAgo) d++;
        if (itemTime >= sevenDaysAgo) w++;
        if (itemTime >= thirtyDaysAgo) m++;
      });
      setStats({ total: data.length, today: d, weekly: w, monthly: m, unique_ips: ips.size });
    }
  }, [data]);

  const paginated = data.slice((currentPage - 1) * limit, currentPage * limit);
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between flex-wrap gap-2">
        <span className="font-bold text-gray-800">{title}</span>
        {stats.unique_ips > 0 && (
          <span className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-2xs">
            {stats.unique_ips} IP Pengguna Unik
          </span>
        )}
      </div>
      
      {/* Infografis Statistik Log */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border shadow-2xs bg-gray-50/70 border-gray-200">
          <div className="p-2.5 md:p-3 bg-gray-200 text-gray-700 rounded-lg"><Layers size={22} /></div>
          <div><div className="text-xs md:text-sm text-gray-500 font-medium">Total Keseluruhan</div><div className="text-xl md:text-2xl font-bold text-gray-800">{stats.total.toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border shadow-2xs bg-blue-50/50 border-blue-100">
          <div className="p-2.5 md:p-3 bg-blue-100 text-blue-600 rounded-lg"><Activity size={22} /></div>
          <div><div className="text-xs md:text-sm text-gray-500 font-medium">Hari Ini (24 Jam)</div><div className="text-xl md:text-2xl font-bold text-blue-800">{stats.today.toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border shadow-2xs bg-emerald-50/50 border-emerald-100">
          <div className="p-2.5 md:p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Calendar size={22} /></div>
          <div><div className="text-xs md:text-sm text-gray-500 font-medium">Minggu Ini (7 Hari)</div><div className="text-xl md:text-2xl font-bold text-emerald-800">{stats.weekly.toLocaleString('id-ID')}</div></div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border shadow-2xs bg-purple-50/50 border-purple-100">
          <div className="p-2.5 md:p-3 bg-purple-100 text-purple-600 rounded-lg"><BarChart2 size={22} /></div>
          <div><div className="text-xs md:text-sm text-gray-500 font-medium">Bulan Ini (30 Hari)</div><div className="text-xl md:text-2xl font-bold text-purple-800">{stats.monthly.toLocaleString('id-ID')}</div></div>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useModalFocus(undefined, !menuOpen);
  const drawerRef = useModalFocus(() => setMenuOpen(false), menuOpen);
  const [view, setViewState] = useState<AdminView>(() => adminLocation(window.location.hash).view);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageRow | null>(null);
  const [stats, setStats] = useState<any>({});
  const [restoring, setRestoring] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [restoredHash, setRestoredHash] = useState(window.location.hash);
  const requestId = useRef(0);
  type Context = {category?: Category; book?: Book; page?: PageRow};
  const restoreRef = useRef<(context?: Context) => void>(() => {});
  restoreRef.current = async (context = {}) => {
    if (parseNavigation(window.location.hash, window.location.search).tab !== 'admin') return;
    const route = adminLocation(window.location.hash), id = ++requestId.current;
    setViewState(route.view); setRestoredHash(window.location.hash); setMenuOpen(false); setRouteError(''); setRestoring(false);
    const nested = ['books','pages','edit_page'].includes(route.view);
    if (!nested) { setSelectedCategory(null); setSelectedBook(null); setSelectedPage(null); return; }
    setRestoring(true);
    try {
      const {category,book,page} = await restoreAdminEntities(route, {
        category:context.category || selectedCategory || undefined,
        book:context.book || selectedBook || undefined,
        page:context.page || selectedPage || undefined,
      }, {
        book:webAPI.getBookInfo,
        categories:() => webAPI.getAdminCategories(token),
        page:(bookId,pageId) => webAPI.getAdminPage(token,bookId,pageId),
      });
      if (id !== requestId.current) return;
      setSelectedCategory(category); setSelectedBook(book); setSelectedPage(page);
    } catch (error) {
      if (id !== requestId.current) return;
      const message = error instanceof Error ? error.message : 'Gagal memulihkan lokasi admin.';
      if (message === '401') onLogout(); else setRouteError(message);
    } finally { if (id === requestId.current) setRestoring(false); }
  };
  const setView = (next:AdminView, context:Context = {}) => {
    const previous = adminLocation(window.location.hash);
    const nested = ['books','pages','edit_page'].includes(next);
    const category = context.category || selectedCategory;
    const book = context.book || selectedBook;
    const page = context.page || selectedPage;
    const params:Record<string,string|number|undefined> = {view:next};
    if (nested || next === 'categories') {
      const old=parseNavigation(window.location.hash).params;
      for (const key of ['cq','cpage','csize']) params[key]=old.get(key) ?? undefined;
    }
    if (nested) {
      params.cat = category?.id ?? previous.categoryId;
      if (next !== 'books') params.book = book?.bkid ?? previous.bookId;
      if (next === 'edit_page') params.pid = page?.id ?? previous.pageId;
      if (params.cat === previous.categoryId) {
        const old = parseNavigation(window.location.hash).params;
        for (const key of ['bq','bpage','bsize']) params[key] = old.get(key) ?? undefined;
        if (params.book === previous.bookId) for (const key of ['ppage','psize']) params[key] = old.get(key) ?? undefined;
      }
    }
    const hash = navigationHash('admin', params);
    if (hash !== window.location.hash) pushLocation(hash);
    restoreRef.current(context);
  };
  useEffect(() => {
    const restore = () => restoreRef.current();
    restore();
    window.addEventListener('popstate',restore); window.addEventListener('hashchange',restore);
    window.addEventListener('maktabah:navigate',restore);
    return () => { ++requestId.current; window.removeEventListener('popstate',restore); window.removeEventListener('hashchange',restore); window.removeEventListener('maktabah:navigate',restore); };
  },[token]);

  const fetchStats = useCallback(() => {
    adminFetch(token, () => webAPI.getAdminStats(token), onLogout, () => {}).then(res => {
      if (res && res.data) setStats(res.data);
    });
  }, [token, onLogout]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const breadcrumb = [
    {label:'Admin',onClick:() => setView('categories')},
    {label:adminGroup(view),onClick:() => setView(['books','pages','edit_page'].includes(view)?'categories':view)},
    ...(!['categories','books','pages','edit_page'].includes(view)?[{label:adminTitle(view),onClick:() => {}}]:[]),
    ...(['books','pages','edit_page'].includes(view) && selectedCategory ? [{label:selectedCategory.name,onClick:() => setView('books')}] : []),
    ...(['pages','edit_page'].includes(view) && selectedBook ? [{label:selectedBook.bk,onClick:() => setView('pages')}] : []),
    ...(view === 'edit_page' && selectedPage ? [{label:`Juz ${selectedPage.part} Hal ${selectedPage.page}`,onClick:() => {}}] : []),
  ];
  const goBack = () => setView(adminParent(view));

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Panel administrator" tabIndex={-1} className="fixed inset-0 bg-gray-100 flex flex-col z-[80] overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white border-b px-3 md:px-6 py-3 flex flex-wrap justify-between items-center gap-2 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="admin-menu" className="lg:hidden px-3 py-2 rounded-lg bg-gray-100 text-sm font-semibold">Menu</button>
          <BackButton onClick={view==='categories'?onClose:goBack} title={view==='categories'?'Kembali ke beranda':`Kembali ke ${adminTitle(adminParent(view))}`}/>
          {/* Breadcrumb */}
          <nav aria-label="Lokasi administrator" className="hidden sm:flex items-center gap-1 text-sm overflow-x-auto min-w-0">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
                <button onClick={b.onClick} aria-current={i === breadcrumb.length - 1 ? 'page' : undefined} className={`shrink-0 font-semibold transition-colors max-w-[200px] truncate ${i === breadcrumb.length - 1 ? 'text-[var(--app-primary)]' : 'text-gray-500 hover:text-gray-800'}`} dir="auto" style={i > 0 ? { fontFamily: 'var(--arabic-font)' } : {}}>
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

      
      <div className="flex flex-1 min-h-0 relative">
        {menuOpen && <button className="absolute inset-0 z-40 bg-black/40 lg:hidden" aria-label="Tutup menu admin" onClick={() => setMenuOpen(false)} />}
        <div ref={drawerRef} id="admin-menu" tabIndex={-1} role={menuOpen?'dialog':undefined} aria-modal={menuOpen?true:undefined} aria-label="Menu admin" className={`${menuOpen?'absolute inset-y-0 left-0 z-50':'hidden'} lg:static lg:block w-64 max-w-[85vw] shrink-0 bg-white border-r overflow-y-auto`}>
          <div className="lg:hidden m-4"><BackButton onClick={() => setMenuOpen(false)} title="Kembali ke halaman admin"/></div>
          <AdminNavigation view={view} onNavigate={next => setView(next)} stats={stats} />
        </div>
        <div className="flex-1 min-w-0 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          {restoring ? <p role="status" className="p-8 text-center">Memuat lokasi admin…</p> : routeError ? <div role="alert" className="p-5 bg-white border rounded-xl space-y-3"><p>{routeError}</p><button onClick={() => restoreRef.current()} className="underline mr-4">Coba lagi</button><button onClick={() => setView('categories')} className="underline">Kembali ke kategori</button></div> : <>
          {view === 'storage' && <section><h1 className="text-xl font-bold mb-4">Backup & Penyimpanan</h1><StorageCleanup token={token} busy={false} onLogout={onLogout} onCleaned={fetchStats} /></section>}
          {['categories', 'books', 'pages', 'edit_page'].includes(view) && <div className="flex justify-end mb-4"><button onClick={() => { setView('transfer'); setSelectedCategory(null); setSelectedBook(null); setSelectedPage(null); }} className="inline-flex items-center gap-2 bg-[var(--app-primary)] text-white font-semibold text-sm px-4 py-2.5 rounded-xl"><FolderSync size={18} /> Import / Export Kitab</button></div>}
          {view === 'ai_settings' && <AiSettings token={token} onLogout={onLogout} />}
          {view === 'transfer' && <BookTransfer token={token} onLogout={onLogout} onBack={() => setView('categories')} onChanged={fetchStats} onStorage={() => setView('storage')} />}
          {view === 'rowa_database' && <RowaDatabase token={token} onLogout={onLogout} />}
          {view === 'categories' && (
            <CategoriesView key={restoredHash} token={token} onLogout={onLogout} onChanged={fetchStats} onSelectCategory={cat => setView('books',{category:cat})} />
          )}
          {view === 'books' && selectedCategory && (
            <BooksView key={restoredHash} token={token} onLogout={onLogout} onChanged={fetchStats} category={selectedCategory} onSelectBook={book => setView('pages',{book})} />
          )}
          {view === 'pages' && selectedBook && (
            <PagesView key={restoredHash} token={token} onLogout={onLogout} book={selectedBook} onEditPage={page => setView('edit_page',{page})} />
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
          </>}
        </div>
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
