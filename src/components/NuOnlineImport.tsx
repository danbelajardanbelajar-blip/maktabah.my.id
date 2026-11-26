import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Eye, Globe, Loader2, RefreshCw, Search, Upload, X } from 'lucide-react';
import { webAPI } from '../api';
import { BackButton } from './BackButton';

type IndexedPost = {
  url: string;
  slug: string;
  title: string;
  author?: string | null;
  published_at?: string | null;
  excerpt?: string | null;
  imported_bkid?: number | null;
};

type ArticlePreview = {
  url: string;
  title: string;
  author: string;
  publishedAt: string;
  paragraphs: string[];
  fullText: string;
  containsBahtsulMasail: boolean;
  imported_bkid?: number | null;
};

type Category = { id: number; name: string };

export function NuOnlineImport({
  token,
  onLogout,
  onBack,
  onChanged,
}: {
  token: string;
  onLogout: () => void;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [posts, setPosts] = useState<IndexedPost[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, imported: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'unimported' | 'imported'>('all');
  const [loading, setLoading] = useState(false);

  // Indexing controls
  const [startPage, setStartPage] = useState(1);
  const [pageCount, setPageCount] = useState(2);
  const [keyword, setKeyword] = useState('bahtsul masail');
  const [indexing, setIndexing] = useState(false);
  const [indexNotice, setIndexNotice] = useState('');

  // Preview & Import
  const [categories, setCategories] = useState<Category[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const [importTitle, setImportTitle] = useState('');
  const [importAuthor, setImportAuthor] = useState('');
  const [importCatId, setImportCatId] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const apiCall = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    });
    if (res.status === 401) {
      onLogout();
      throw new Error('Sesi berakhir. Silakan login kembali.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Permintaan gagal (${res.status}).`);
    return data;
  }, [token, onLogout]);

  const loadPosts = useCallback(async (p = page, search = q, st = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
        status: st,
        ...(search.trim() ? { q: search.trim() } : {}),
      });
      const res = await apiCall(`/api/admin/nu-online/posts?${params}`);
      setPosts(res.data || []);
      setTotal(res.total || 0);
      setStats(res.stats || { total: 0, imported: 0 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiCall, page, q, status]);

  useEffect(() => {
    void loadPosts(page, q, status);
  }, [page, status]);

  useEffect(() => {
    webAPI.getAdminCategories(token).then((res) => {
      const cats: Category[] = res.data || [];
      setCategories(cats);
      const preferred = cats.find((c) => /bahtsul|bm-|ibarat/i.test(c.name)) || cats[0];
      if (preferred) setImportCatId(String(preferred.id));
    }).catch(() => {});
  }, [token]);

  const handleIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    setIndexing(true);
    setError('');
    setIndexNotice('');
    try {
      const res = await apiCall('/api/admin/nu-online/index', {
        method: 'POST',
        body: JSON.stringify({ startPage, pageCount, keyword }),
      });
      setIndexNotice(`Berhasil mengindeks halaman ${res.startPage}–${res.startPage + res.pageCount - 1}: ${res.matched} artikel cocok (${res.newCount} artikel baru).`);
      setStartPage(res.startPage + res.pageCount);
      setPage(1);
      await loadPosts(1, q, status);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIndexing(false);
    }
  };

  const openPreview = async (url: string) => {
    setPreviewLoading(true);
    setError('');
    setSuccessMsg('');
    setArticle(null);
    try {
      const res = await apiCall(`/api/admin/nu-online/preview?url=${encodeURIComponent(url)}`);
      const art: ArticlePreview = res.article;
      setArticle(art);
      setImportTitle(art.title);
      setImportAuthor(art.author || 'Redaksi NU Online');
      await loadPosts(page, q, status);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!article || !importTitle.trim() || !importCatId) return;
    setImporting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiCall('/api/admin/nu-online/import', {
        method: 'POST',
        body: JSON.stringify({
          url: article.url,
          title: importTitle.trim(),
          author: importAuthor.trim(),
          catId: Number(importCatId),
          content: article.fullText,
          publishedAt: article.publishedAt,
        }),
      });
      setSuccessMsg(`Berhasil di-import sebagai kitab baru "${res.book.bk}" (ID #${res.book.bkid}, ${res.book.pagesCount} halaman).`);
      setArticle({ ...article, imported_bkid: res.book.bkid });
      await loadPosts(page, q, status);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton onClick={onBack} label="Kembali" />
            <div>
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Globe size={20} className="text-[var(--app-primary)]" />
                Import Artikel Bahtsul Masail (NU Online)
              </h2>
              <p className="text-xs text-gray-500">
                Indeks postingan dari <code className="bg-gray-100 px-1 rounded">islam.nu.or.id/bahtsul-masail</code>, baca isinya, lalu import menjadi 1 kitab baru.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Terindeks: {stats.total}</span>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">Sudah Di-import: {stats.imported}</span>
          </div>
        </div>

        {/* Form Indexing */}
        <form onSubmit={handleIndex} className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-gray-700 flex-1 min-w-[180px]">
            Kata Kunci / Kalimat Filter
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="bahtsul masail"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700 w-28">
            Mulai Hal.
            <input
              type="number"
              min={1}
              max={200}
              value={startPage}
              onChange={(e) => setStartPage(Number(e.target.value) || 1)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700 w-32">
            Jumlah Halaman
            <select
              value={pageCount}
              onChange={(e) => setPageCount(Number(e.target.value))}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white font-normal"
            >
              <option value={1}>1 halaman</option>
              <option value={2}>2 halaman</option>
              <option value={3}>3 halaman</option>
              <option value={5}>5 halaman</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={indexing}
            className="inline-flex items-center gap-2 bg-[var(--app-primary)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[var(--app-primary-hover)] disabled:opacity-50"
          >
            {indexing ? <><Loader2 size={16} className="animate-spin" /> Mengindeks...</> : <><RefreshCw size={16} /> Index NU Online</>}
          </button>
        </form>

        {indexNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{indexNotice}</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="p-1"><X size={15} /></button>
          </div>
        )}

        {/* Filter & Search Index */}
        <div className="flex flex-wrap gap-2 items-center">
          <form
            onSubmit={(e) => { e.preventDefault(); setPage(1); void loadPosts(1, q, status); }}
            className="flex flex-1 min-w-[220px]"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul artikel terindeks..."
              className="border rounded-l-lg px-3 py-2 text-sm w-full bg-white"
            />
            <button type="submit" className="bg-gray-800 text-white px-3 py-2 rounded-r-lg hover:bg-gray-700">
              <Search size={16} />
            </button>
          </form>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">Semua status ({stats.total})</option>
            <option value="unimported">Belum di-import ({stats.total - stats.imported})</option>
            <option value="imported">Sudah di-import ({stats.imported})</option>
          </select>
        </div>

        {/* List */}
        <div className="border rounded-xl overflow-hidden divide-y">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Memuat daftar artikel...</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Belum ada artikel terindeks. Klik <strong>"Index NU Online"</strong> di atas untuk mengambil daftar postingan Bahtsul Masail.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.url} className="p-3.5 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.imported_bkid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} /> Sudah Di-import (ID #{post.imported_bkid})
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        Belum Di-import
                      </span>
                    )}
                    {post.author && <span className="text-xs text-gray-500">• {post.author}</span>}
                  </div>
                  <div className="font-semibold text-gray-800 text-sm md:text-base">{post.title}</div>
                  {post.excerpt && <p className="text-xs text-gray-500 line-clamp-1">{post.excerpt}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void openPreview(post.url)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200"
                  >
                    <Eye size={14} /> Buka Isi Postingan
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
            <span>Halaman {page} dari {totalPages} ({total} artikel)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Sebelumnya</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal / View Isi Postingan & Tombol Import di Bawahnya */}
      {(previewLoading || article) && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-end md:items-center justify-center md:p-4" onClick={() => { if (!importing) setArticle(null); }}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full md:max-w-3xl max-h-[92vh] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 p-4 border-b bg-gray-50">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-800 truncate">{previewLoading ? 'Memuat isi postingan...' : article?.title}</h3>
                {article && (
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                    <span>{article.author || 'NU Online'}</span>
                    {article.publishedAt && <span>• {article.publishedAt.slice(0, 10)}</span>}
                    <a href={article.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      Buka sumber asli <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setArticle(null)} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            {previewLoading ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-[var(--app-primary)]" />
                <span>Mengambil isi postingan dari NU Online...</span>
              </div>
            ) : article && (
              <>
                {/* View Isi Postingan */}
                <div className="overflow-y-auto p-5 space-y-3 text-sm leading-relaxed text-gray-800 flex-1 bg-white">
                  {article.paragraphs.map((para, idx) => (
                    <p key={idx} dir="auto" style={{ fontFamily: /[\u0600-\u06FF]/.test(para) ? 'var(--arabic-font)' : undefined }} className={/[\u0600-\u06FF]/.test(para) ? 'text-base leading-loose bg-amber-50/40 p-2.5 rounded-lg border border-amber-100' : ''}>
                      {para}
                    </p>
                  ))}
                </div>

                {/* Form & Tombol Import di Bawah View Isi Postingan */}
                <form onSubmit={handleImport} className="p-4 border-t bg-gray-50 space-y-3">
                  {successMsg && (
                    <div className="p-2.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <label className="text-xs font-semibold text-gray-700 md:col-span-1">
                      Kategori Kitab *
                      <select
                        required
                        value={importCatId}
                        onChange={(e) => setImportCatId(e.target.value)}
                        className="mt-1 w-full border rounded-lg px-2.5 py-2 text-xs bg-white font-normal"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-700 md:col-span-1">
                      Judul Kitab *
                      <input
                        required
                        value={importTitle}
                        onChange={(e) => setImportTitle(e.target.value)}
                        className="mt-1 w-full border rounded-lg px-2.5 py-2 text-xs bg-white font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-gray-700 md:col-span-1">
                      Pengarang
                      <input
                        value={importAuthor}
                        onChange={(e) => setImportAuthor(e.target.value)}
                        className="mt-1 w-full border rounded-lg px-2.5 py-2 text-xs bg-white font-normal"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <BookOpen size={13} /> Disimpan sebagai 1 kitab baru ke Maktabah
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setArticle(null)} className="px-4 py-2 rounded-lg border text-xs font-semibold bg-white hover:bg-gray-100">
                        Tutup
                      </button>
                      <button
                        type="submit"
                        disabled={importing || !importTitle.trim() || !importCatId}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--app-primary)] text-white text-xs font-bold hover:bg-[var(--app-primary-hover)] disabled:opacity-50"
                      >
                        {importing ? <><Loader2 size={14} className="animate-spin" /> Mengimport...</> : <><Upload size={14} /> {article.imported_bkid ? 'Import Lagi sebagai Kitab Baru' : 'Import ke Maktabah'}</>}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
