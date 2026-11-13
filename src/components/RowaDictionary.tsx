import {RowaProfileModal,parseKutub,formatYear,getKitabColor} from './RowaProfileModal';
import type {RowaResult,RowaDetail} from './RowaProfileModal';
import React, { useState, useCallback, useRef } from 'react';
import { Search, User, BookOpen, ChevronLeft, ChevronRight, X, AlertCircle, Info } from 'lucide-react';
import { webAPI } from '../api';
import { rowaFullName } from '../lib/rowa-name';

// ============================================================
// TYPES
// ============================================================
interface SearchResponse {data:RowaResult[];total:number;page:number;limit:number;totalPages:number;error:string|null;}

// ============================================================
// HELPERS
// ============================================================
// ============================================================
// SUB-COMPONENTS
// ============================================================

const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
    <div className="flex justify-between items-start gap-4">
      <div className="flex-1 space-y-3">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
      <div className="h-10 w-28 bg-gray-200 rounded-lg shrink-0" />
    </div>
  </div>
);

const DerajatBadge = ({ text, color }: { text?: string; color: string }) => {
  if (!text || text.trim() === '' || text.trim() === '-') return null;
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-800 border-green-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
  };
  return (
    <span className={`inline-block text-xs px-2.5 py-1 rounded-full border font-medium leading-snug ${colorMap[color] || colorMap.green}`} dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
      {text}
    </span>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="text-center py-16 text-gray-400">
    <Search className="mx-auto mb-4 opacity-30" size={48} />
    <p className="text-lg">{message}</p>
  </div>
);

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mt-4">
    <AlertCircle className="shrink-0 mt-0.5" size={18} />
    <div>
      <p className="font-semibold">Terjadi Kesalahan</p>
      <p className="text-sm mt-1">{message}</p>
    </div>
  </div>
);

const SearchHint = () => (
  <div id="rowa-search-hint" className="flex items-start gap-2 text-gray-500 mt-3">
    <Info className="shrink-0 mt-0.5" size={18} />
    <p className="text-sm">
      Cari nama perawi dalam huruf Arab, lalu pilih Lihat Profil untuk membaca biografinya.
    </p>
  </div>
);

// ============================================================
// PROFILE MODAL
// ============================================================
// ============================================================
// MAIN COMPONENT
// ============================================================
const RowaDictionary: React.FC = () => {
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<RowaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedRowa, setSelectedRowa] = useState<RowaDetail | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const LIMIT = 20;

  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string, pg = 1) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setHasSearched(true);
    try {
      const res = await (webAPI as any).searchRowa(q, pg, LIMIT) as SearchResponse;
      if (res.error && !res.data?.length) {
        setError(res.error);
        setResults([]);
        setTotal(0);
        setTotalPages(0);
      } else {
        setResults(res.data || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 0);
        setPage(res.page || pg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setResults([]);
      setTotal(0);
      setTotalPages(0);
    }
    setLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    setQuery(q);
    setPage(1);
    doSearch(q, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    doSearch(query, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProfile = async (id: number) => {
    setLoadingProfile(id);
    try {
      const res = await (webAPI as any).getRowaInfo(id);
      if (res.data) {
        setSelectedRowa(res.data);
      } else {
        setError(res.error || 'Data perawi tidak ditemukan');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat profil');
    }
    setLoadingProfile(null);
  };

  // Dipanggil saat klik nama guru/murid dari dalam modal
  const handleSearchFromModal = (name: string) => {
    setInputValue(name);
    setQuery(name);
    setPage(1);
    doSearch(name, 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClear = () => {
    setInputValue('');
    setQuery('');
    setResults([]);
    setError('');
    setHasSearched(false);
    setTotal(0);
    setTotalPages(0);
    setPage(1);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-3xl mx-auto" dir="auto">

      {/* Search Box */}
      <div className="bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <BookOpen className="text-[var(--app-primary)]" size={22} />
          <h2 className="text-xl font-bold text-gray-800">Kamus Biografi Perawi</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Cari nama perawi, misalnya أحمد بن إبراهيم"
              aria-label="Nama perawi"
              aria-describedby="rowa-search-hint"
              className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-gray-200 focus:border-[var(--app-primary)] focus:outline-none text-base bg-white transition-colors"
              dir="auto"
              autoComplete="off"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="bg-[var(--app-primary)] text-white px-5 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            <Search size={18} />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </form>
        <SearchHint />
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Results header */}
      {hasSearched && !loading && !error && (
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-sm text-gray-500">
            {total > 0
              ? <>Ditemukan <strong>{total}</strong> perawi untuk "<strong>{query}</strong>"</>
              : <>Tidak ada perawi untuk "<strong>{query}</strong>"</>
            }
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-gray-400">Hal {page} dari {totalPages}</p>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Results list */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => {
            const kutubList = parseKutub(r.kutub);
            const fullName = rowaFullName(r);
            const showShortName = r.Name?.trim() && r.Name.trim() !== fullName;

            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 hover:border-[var(--app-primary)]/30 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Nama lengkap, termasuk sumber IsoName pada database lama. */}
                    <h3
                      className="text-xl font-bold text-gray-900 mb-1 leading-relaxed break-words whitespace-normal"
                      dir="rtl"
                      style={{ fontFamily: 'var(--arabic-font)' }}
                    >
                      {fullName}
                    </h3>

                    {/* Nama ringkas tetap tersedia jika berbeda dari nama lengkap. */}
                    {showShortName && (
                      <p
                        className="text-sm text-gray-500 mb-1 leading-snug"
                        dir="rtl"
                        style={{ fontFamily: 'var(--arabic-font)' }}
                      >
                        {r.Name}
                      </p>
                    )}

                    {/* Kunyah */}
                    {r.A_kona && (
                      <p className="text-xs text-gray-400 mb-2" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                        {r.A_kona}
                      </p>
                    )}

                    {/* Derajat badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {r.ROTBA && <DerajatBadge text={r.ROTBA} color="green" />}
                      {r.R_ZAHBI && !r.ROTBA && <DerajatBadge text={r.R_ZAHBI} color="blue" />}
                      {!r.ROTBA && !r.R_ZAHBI && (
                        <span className="text-xs text-gray-300 italic">–</span>
                      )}
                    </div>

                    {/* Nama Kitab */}
                    {kutubList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {kutubList.slice(0, 6).map((k, i) => (
                          <span
                            key={i}
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getKitabColor(k)}`}
                            dir="rtl"
                            style={{ fontFamily: 'var(--arabic-font)' }}
                          >
                            {k}
                          </span>
                        ))}
                        {kutubList.length > 6 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            +{kutubList.length - 6}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tahun Lahir/Wafat */}
                    <p className="text-xs text-gray-400">
                      Lahir: <strong>{formatYear(r.birth)}</strong> H &nbsp;|&nbsp;
                      Wafat: <strong>{formatYear(r.death)}</strong> H
                    </p>
                  </div>

                  {/* Tombol Lihat Profil */}
                  <button
                    onClick={() => openProfile(r.id)}
                    disabled={loadingProfile === r.id}
                    className="shrink-0 bg-[var(--app-primary)] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2 w-full sm:w-auto justify-center"
                  >
                    {loadingProfile === r.id ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <User size={15} />
                    )}
                    {loadingProfile === r.id ? 'Memuat...' : 'Lihat Profil'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && hasSearched && results.length === 0 && !error && (
        <EmptyState message={`Tidak ada perawi bernama "${query}"`} />
      )}

      {/* Initial empty state */}
      {!loading && !hasSearched && (
        <EmptyState message="Masukkan nama perawi untuk mulai mencari" />
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-200 hover:border-[var(--app-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                  pageNum === page
                    ? 'bg-[var(--app-primary)] text-white'
                    : 'border border-gray-200 hover:border-[var(--app-primary)] text-gray-600'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-gray-200 hover:border-[var(--app-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Profile Modal */}
      {selectedRowa && (
        <RowaProfileModal
          rowa={selectedRowa}
          onClose={() => setSelectedRowa(null)}
          onSearchName={handleSearchFromModal}
        />
      )}
    </div>
  );
};

export default RowaDictionary;
