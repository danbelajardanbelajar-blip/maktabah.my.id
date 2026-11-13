import { pushLocation } from '../lib/back-navigation';
import { useEffect, useState, useMemo } from 'react';
import { Folder, ChevronLeft, ChevronRight, BookOpen, User, Info, Download, FileText, Search, X, Loader2, BookMarked } from 'lucide-react';
import { webAPI } from '../api';
import { BackButton } from './BackButton';
import { navigationHash, parseNavigation, routePage } from '../lib/navigation';
import { groupCategoryFamilies } from '../lib/category-families';

interface CatalogRoute {
  cat: number | null;
  query: string;
  filter: string;
  page: number;
  bookPage: number;
}

const location = (): CatalogRoute => {
  const { params } = parseNavigation(window.location.hash);
  const raw = params.get('cat');
  const cat = raw !== null && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
  const filter = params.get('filter') || params.get('q') || '';
  return {
    cat,
    query: params.get('q') || '',
    filter,
    page: routePage(params.get('page')),
    bookPage: routePage(params.get('bpage'))
  };
};

export default function Catalog({ openBook, readBook }: { openBook: (id: number) => void; readBook: (id: number) => void }) {
  const [route, setRoute] = useState<CatalogRoute>(location);
  const [categories, setCategories] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [bookError, setBookError] = useState('');
  const [draft, setDraft] = useState(route.query);
  const [retry, setRetry] = useState(0);

  // State untuk Pencarian Judul Kitab
  const [bookSearchDraft, setBookSearchDraft] = useState(route.filter);
  const [bookSearchResults, setBookSearchResults] = useState<any[]>([]);
  const [bookSearchTotal, setBookSearchTotal] = useState(0);
  const [bookSearchPages, setBookSearchPages] = useState(1);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [bookSearchError, setBookSearchError] = useState('');

  const go = (
    cat: number | null,
    query = '',
    page = 1,
    filter = route.filter,
    replace = false,
    bookPage = route.bookPage
  ) => {
    window.history.replaceState({ ...window.history.state, scrollY: window.scrollY }, '');
    const hash = navigationHash('catalog', {
      cat: cat === null ? undefined : cat,
      q: query || undefined,
      page: cat === null ? undefined : page,
      filter: filter || undefined,
      bpage: cat === null && bookPage > 1 ? bookPage : undefined
    });
    if (replace) window.history.replaceState(window.history.state, '', hash);
    else pushLocation(hash);
    window.dispatchEvent(new Event('maktabah:navigate'));
    if (!replace) window.scrollTo(0, 0);
  };

  useEffect(() => {
    const sync = () => {
      if (parseNavigation(window.location.hash).tab !== 'catalog') return;
      const next = location();
      setRoute(next);
      setDraft(next.query);
      setBookSearchDraft(next.filter);
    };
    for (const name of ['popstate', 'hashchange', 'maktabah:navigate']) window.addEventListener(name, sync);
    return () => {
      for (const name of ['popstate', 'hashchange', 'maktabah:navigate']) window.removeEventListener(name, sync);
    };
  }, []);

  // Memuat daftar kategori induk
  useEffect(() => {
    let current = true;
    setCategoriesLoading(true);
    setCategoryError('');
    webAPI.getCategories()
      .then(res => {
        if (current) setCategories(res.data || []);
      })
      .catch(() => {
        if (current) setCategoryError('Kategori gagal dimuat. Periksa koneksi dan coba lagi.');
      })
      .finally(() => {
        if (current) setCategoriesLoading(false);
      });
    return () => { current = false; };
  }, [retry]);

  // Memuat kitab di dalam kategori terpilih (route.cat !== null)
  useEffect(() => {
    if (route.cat === null) return;
    let current = true;
    setLoading(true);
    setBookError('');
    webAPI.getCategoryBooks(route.cat, route.page, route.query, 30)
      .then(res => {
        if (!current) return;
        setBooks(res.data || []);
        setTotal(res.total || 0);
        setPages(res.totalPages || 1);
        if (res.page !== route.page) go(route.cat, route.query, res.page, route.filter, true, route.bookPage);
      })
      .catch(() => {
        if (current) setBookError('Daftar kitab gagal dimuat. Periksa koneksi dan coba lagi.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [route.cat, route.page, route.query, retry]);

  // Memuat pencarian judul kitab secara lintas katalog
  useEffect(() => {
    if (route.cat !== null) return;
    const trimmedFilter = route.filter.trim();
    if (!trimmedFilter) {
      setBookSearchResults([]);
      setBookSearchTotal(0);
      setBookSearchPages(1);
      setBookSearchLoading(false);
      setBookSearchError('');
      return;
    }

    let current = true;
    setBookSearchLoading(true);
    setBookSearchError('');

    webAPI.searchTitles(trimmedFilter, route.bookPage, 20)
      .then(res => {
        if (!current) return;
        setBookSearchResults(res.data || []);
        setBookSearchTotal(res.total || 0);
        const calculatedPages = Math.max(1, Math.ceil((res.total || 0) / 20));
        setBookSearchPages(calculatedPages);
      })
      .catch(() => {
        if (current) setBookSearchError('Gagal memuat pencarian judul kitab.');
      })
      .finally(() => {
        if (current) setBookSearchLoading(false);
      });

    return () => { current = false; };
  }, [route.cat, route.filter, route.bookPage, retry]);

  // Filter kategori di sisi klien
  const filteredCategories = useMemo(() => {
    if (!route.filter) return categories;
    const lower = route.filter.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(lower));
  }, [categories, route.filter]);
  const categoryFamilies = useMemo(() => groupCategoryFamilies(filteredCategories), [filteredCategories]);

  const error = categoryError || bookError;

  return (
    <section className="bg-[var(--reader-bg)] rounded-2xl border border-black/5 p-4 md:p-6 shadow-sm">
      {/* Breadcrumb Navigasi */}
      <nav aria-label="Lokasi katalog" className="flex items-center gap-2 text-sm mb-4">
        <button onClick={() => go(null, '', 1, '', false, 1)} className="text-[var(--app-primary)] font-semibold hover:underline">
          Katalog
        </button>
        {route.cat !== null && (
          <>
            <ChevronRight size={14} className="text-gray-400" />
            <span dir="auto" className="font-bold text-gray-700">
              {categories.find(c => c.id === route.cat)?.name || `Kategori #${route.cat}`}
            </span>
          </>
        )}
      </nav>

      {error && (
        <div role="alert" className="p-4 bg-red-50 text-red-800 rounded-xl mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setRetry(v => v + 1)} className="ml-3 underline font-bold">Coba lagi</button>
        </div>
      )}

      {/* KONDISI 1: BERANDA KATALOG (route.cat === null) */}
      {route.cat === null ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
                <BookMarked className="text-[var(--app-primary)]" /> Katalog Perpustakaan
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                Jelajahi Hasil Bahsul Masail dan Kitab Turats, atau cari judul kitab di bawah.
              </p>
            </div>
          </div>

          {/* Kolom Pencarian Universal Katalog */}
          <div className="relative mb-6">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="catalog-universal-search"
              type="search"
              aria-label="Cari kategori atau judul kitab"
              value={bookSearchDraft}
              onChange={e => {
                const val = e.target.value;
                setBookSearchDraft(val);
                go(null, '', 1, val, true, 1);
              }}
              placeholder="Cari kategori atau judul kitab di sini..."
              className="w-full pl-10 pr-10 py-3 text-sm md:text-base border border-gray-200 rounded-xl bg-[var(--reader-paper)] shadow-2xs focus:outline-none focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-primary)]/20 transition-all"
            />
            {bookSearchDraft && (
              <button
                type="button"
                onClick={() => {
                  setBookSearchDraft('');
                  go(null, '', 1, '', true, 1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label="Hapus pencarian"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* BAGIAN ATAS: KATEGORI */}
          <div className="catalog-section-categories">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base md:text-lg text-gray-900 flex items-center gap-2">
                <Folder className="text-amber-600" size={20} />
                <span>Kategori</span>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                  {categoriesLoading ? '…' : filteredCategories.length}
                </span>
              </h3>
            </div>

            {categoriesLoading ? (
              <div className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-[var(--app-primary)]" />
                <p role="status" className="text-sm">Memuat daftar kategori…</p>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-6 text-center bg-gray-50/70 border border-dashed rounded-xl text-gray-500 text-sm">
                Tidak ada kategori yang cocok dengan kata kunci &ldquo;{route.filter}&rdquo;.
              </div>
            ) : (
              <div className="space-y-7">
                {categoryFamilies.map(family => <section key={family.id} aria-labelledby={`category-family-${family.id}`} data-category-family={family.id}>
                  <header className="mb-3 rounded-xl border border-[var(--app-primary)]/15 bg-[var(--app-primary)]/5 p-4">
                    <h4 id={`category-family-${family.id}`} className="font-bold text-lg text-[var(--app-primary)] flex items-center gap-2 flex-wrap">
                      <Folder size={19} aria-hidden="true" />{family.title}
                      <span className="text-xs font-semibold rounded-full bg-[var(--reader-paper)] px-2.5 py-1">{family.categories.length.toLocaleString('id-ID')} kategori</span>
                    </h4>
                    <p className="text-xs mt-1 text-[var(--app-text)] opacity-65">{family.description}</p>
                  </header>
                  {family.categories.length === 0 ? <p className="p-4 text-sm text-gray-500 border border-dashed rounded-xl">Tidak ada kategori yang cocok dalam rumpun ini.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {family.categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => go(cat.id, '', 1, '')}
                    className="flex items-center gap-3 text-right bg-[var(--reader-paper)] border border-black/5 rounded-xl p-4 hover:border-[var(--app-primary)] hover:shadow-xs transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--app-primary)]/5 group-hover:bg-[var(--app-primary)]/10 text-[var(--app-primary)] flex items-center justify-center shrink-0 transition-colors">
                      <Folder size={20} />
                    </div>
                    <span className="font-bold text-base md:text-lg flex-1 text-gray-900 group-hover:text-[var(--app-primary)] transition-colors" dir="auto" style={family.id === 'turats' ? { fontFamily: 'var(--arabic-font)' } : undefined}>
                      {cat.name}
                    </span>
                  </button>
                ))}
                  </div>}
                </section>)}
              </div>
            )}
          </div>

          {/* PEMISAH ANTARA KATEGORI DAN KITAB */}
          <hr className="my-8 border-t border-gray-200" />

          {/* BAGIAN BAWAH: KITAB LINTAS KATALOG */}
          <div className="catalog-section-books">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base md:text-lg text-gray-900 flex items-center gap-2">
                <BookOpen className="text-[var(--app-primary)]" size={20} />
                <span>Kitab</span>
                {route.filter.trim() && (
                  <span className="text-xs bg-[var(--app-primary)]/10 text-[var(--app-primary)] font-bold px-2.5 py-0.5 rounded-full">
                    {bookSearchLoading ? <Loader2 size={12} className="animate-spin inline" /> : bookSearchTotal}
                  </span>
                )}
              </h3>
              {route.filter.trim() && bookSearchTotal > 0 && (
                <span className="text-xs text-gray-500">
                  Halaman {route.bookPage} dari {bookSearchPages}
                </span>
              )}
            </div>

            {!route.filter.trim() ? (
              <div className="p-6 text-center bg-gray-50/70 border border-dashed rounded-xl text-gray-500 space-y-1">
                <BookOpen className="mx-auto text-gray-300" size={36} />
                <p className="text-sm font-medium text-gray-700">Ketik kata kunci pada kolom pencarian di atas</p>
                <p className="text-xs text-gray-500">Mencari judul kitab atau pengarang di seluruh koleksi perpustakaan.</p>
              </div>
            ) : bookSearchLoading ? (
              <div className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-[var(--app-primary)]" />
                <p role="status" className="text-sm">Mencari judul kitab di seluruh katalog…</p>
              </div>
            ) : bookSearchError ? (
              <div className="p-4 bg-red-50 text-red-800 rounded-xl text-center text-sm">
                {bookSearchError}
              </div>
            ) : bookSearchResults.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 border rounded-xl space-y-2">
                <BookOpen className="mx-auto text-gray-300" size={36} />
                <p className="text-gray-600 font-medium text-sm">
                  Tidak ada kitab yang cocok dengan kata kunci &ldquo;{route.filter}&rdquo;.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookSearchResults.map(book => (
                  <article
                    key={book.bkid}
                    className="bg-[var(--reader-paper)] border border-black/5 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center hover:border-black/15 transition-all shadow-2xs"
                  >
                    <div className="flex-1 min-w-0 w-full">
                      {/* Judul Kitab */}
                      <button
                        onClick={() => readBook(book.bkid)}
                        className="font-bold text-lg md:text-xl text-left flex items-start gap-2 hover:text-[var(--app-primary)] transition-colors w-full"
                        dir="auto"
                        style={{ fontFamily: 'var(--arabic-font)' }}
                      >
                        <BookOpen className="shrink-0 mt-1 text-[var(--app-primary)]" size={18} />
                        <span className="flex-1">{book.bk}</span>
                      </button>

                      {/* Metadata: Penulis & Kategori */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                        {book.author_name && (
                          <span className="flex items-center gap-1.5" dir="auto">
                            <User size={13} className="text-gray-400" />
                            <span>{book.author_name}</span>
                          </span>
                        )}
                        {book.category_name && (
                          <button
                            type="button"
                            onClick={() => go(book.cat || null, '', 1, '')}
                            className="inline-flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 px-2 py-0.5 rounded-full font-medium transition-colors"
                            dir="auto"
                          >
                            <Folder size={11} className="text-amber-600" />
                            <span>{book.category_name}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bilah Tombol Aksi (Mobile & Desktop) */}
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                      <button
                        onClick={() => readBook(book.bkid)}
                        className="bg-[var(--app-primary)] text-white hover:opacity-90 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold transition-all"
                      >
                        <BookOpen size={14} /> Baca
                      </button>
                      <button
                        onClick={() => openBook(book.bkid)}
                        className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all"
                      >
                        <Info size={14} /> Detail
                      </button>
                      <a
                        href={`/api/download/${book.bkid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all"
                      >
                        <Download size={14} /> Word
                      </a>
                      <a
                        href={`/api/download/${book.bkid}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all"
                      >
                        <FileText size={14} /> PDF
                      </a>
                    </div>
                  </article>
                ))}

                {/* Navigasi Paginasi Kitab */}
                {bookSearchPages > 1 && (
                  <nav aria-label="Halaman pencarian kitab" className="flex items-center justify-center gap-3 mt-6">
                    <button
                      disabled={bookSearchLoading || route.bookPage <= 1}
                      onClick={() => go(null, '', 1, route.filter, false, route.bookPage - 1)}
                      className="border border-gray-200 bg-white rounded-lg p-2 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      aria-label="Halaman sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-semibold text-gray-700">
                      {route.bookPage} / {bookSearchPages}
                    </span>
                    <button
                      disabled={bookSearchLoading || route.bookPage >= bookSearchPages}
                      onClick={() => go(null, '', 1, route.filter, false, route.bookPage + 1)}
                      className="border border-gray-200 bg-white rounded-lg p-2 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      aria-label="Halaman selanjutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* KONDISI 2: DI DALAM KATEGORI SPESIFIK (route.cat !== null) */
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <BackButton onClick={() => go(null, '', 1, route.filter, false, route.bookPage)} label="Kembali ke katalog" />
            <span className="text-xs md:text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {total} kitab
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-900" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>
            {categories.find(c => c.id === route.cat)?.name || `Kategori #${route.cat}`}
          </h2>

          <form onSubmit={e => { e.preventDefault(); go(route.cat, draft, 1, route.filter); }} className="flex gap-2 mb-5">
            <input
              type="search"
              aria-label="Cari judul kitab dalam kategori"
              value={draft}
              maxLength={200}
              onChange={e => setDraft(e.target.value)}
              placeholder="Cari judul dalam kategori ini…"
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-[var(--reader-paper)] focus:outline-none focus:border-[var(--app-primary)]"
            />
            <button className="bg-[var(--app-primary)] text-white rounded-xl px-4 py-2 hover:opacity-95 transition-opacity" aria-label="Cari kitab">
              <Search size={18} />
            </button>
          </form>

          {loading ? (
            <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-[var(--app-primary)]" />
              <p role="status" className="text-sm">Memuat daftar kitab…</p>
            </div>
          ) : !bookError && (
            <div className="space-y-3">
              {books.map(book => (
                <article
                  key={book.bkid}
                  className="bg-[var(--reader-paper)] border border-black/5 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center hover:border-black/15 transition-all shadow-2xs"
                >
                  <div className="flex-1 min-w-0 w-full">
                    <button
                      onClick={() => readBook(book.bkid)}
                      className="font-bold text-lg md:text-xl text-left flex items-start gap-2 hover:text-[var(--app-primary)] transition-colors w-full"
                      dir="auto"
                      style={{ fontFamily: 'var(--arabic-font)' }}
                    >
                      <BookOpen className="shrink-0 mt-1 text-[var(--app-primary)]" size={18} />
                      <span className="flex-1">{book.bk}</span>
                    </button>
                    {book.author_name && (
                      <p className="flex items-center gap-2 text-xs md:text-sm mt-2 text-gray-500" dir="auto">
                        <User size={14} className="text-gray-400" />
                        <span>{book.author_name}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <button
                      onClick={() => readBook(book.bkid)}
                      className="bg-[var(--app-primary)] text-white hover:opacity-90 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold transition-all"
                    >
                      <BookOpen size={14} /> Baca
                    </button>
                    <button
                      onClick={() => openBook(book.bkid)}
                      className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all"
                    >
                      <Info size={14} /> Detail
                    </button>
                    <a
                      href={`/api/download/${book.bkid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all"
                    >
                      <Download size={14} /> Word
                    </a>
                    <a
                      href={`/api/download/${book.bkid}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all"
                    >
                      <FileText size={14} /> PDF
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && !error && !books.length && (
            <p className="py-8 text-center text-gray-500 text-sm">Tidak ada kitab yang cocok.</p>
          )}

          <nav aria-label="Halaman daftar kitab" className="flex items-center justify-center gap-4 mt-6">
            <button
              disabled={loading || route.page <= 1}
              onClick={() => go(route.cat, route.query, route.page - 1, route.filter)}
              className="border border-gray-200 bg-white rounded-lg p-2 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              aria-label="Halaman katalog sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-gray-700">
              {route.page} / {pages}
            </span>
            <button
              disabled={loading || route.page >= pages}
              onClick={() => go(route.cat, route.query, route.page + 1, route.filter)}
              className="border border-gray-200 bg-white rounded-lg p-2 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              aria-label="Halaman katalog selanjutnya"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
