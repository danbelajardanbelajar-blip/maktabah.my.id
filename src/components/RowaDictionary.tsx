import React, { useState, useCallback, useRef } from 'react';
import { Search, User, BookOpen, Users, GraduationCap, ChevronLeft, ChevronRight, X, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { webAPI } from '../api';

// ============================================================
// TYPES
// ============================================================
interface RowaResult {
  id: number;
  Name: string;
  A_esm?: string;
  A_kona?: string;
  kutub?: string;
  ROTBA?: string;
  R_ZAHBI?: string;
  birth?: string | number;
  death?: string | number;
}

interface RowaDetail extends RowaResult {
  A_nasab?: string;
  sheok?: string;
  telmez?: string;
  [key: string]: any;
}

interface SearchResponse {
  data: RowaResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error: string | null;
}

// ============================================================
// HELPERS
// ============================================================
const parseList = (text: string | undefined): string[] => {
  if (!text || text.trim() === '' || text.trim() === '-') return [];
  return text
    .split('#')
    .map(t => t.trim())
    .filter(t => t.length > 0 && t !== 'A' && t !== 'B' && t !== '-');
};

// Parse kutub (books) field — biasanya dipisah dengan # atau koma
const parseKutub = (text: string | undefined): string[] => {
  if (!text || text.trim() === '' || text.trim() === '-') return [];
  const sep = text.includes('#') ? '#' : ',';
  return text
    .split(sep)
    .map(t => t.trim())
    .filter(t => t.length > 0 && t !== '-');
};

const formatYear = (y: string | number | undefined): string => {
  if (!y || y === 0 || y === '0') return '?';
  return String(y);
};

// Warna badge per nama kitab terkenal
const KITAB_COLORS: Record<string, string> = {
  'بخاري': 'bg-amber-100 text-amber-800 border-amber-200',
  'مسلم': 'bg-green-100 text-green-800 border-green-200',
  'أبو داود': 'bg-blue-100 text-blue-800 border-blue-200',
  'ترمذي': 'bg-purple-100 text-purple-800 border-purple-200',
  'نسائي': 'bg-pink-100 text-pink-800 border-pink-200',
  'ابن ماجه': 'bg-orange-100 text-orange-800 border-orange-200',
};

const getKitabColor = (name: string): string => {
  for (const [key, color] of Object.entries(KITAB_COLORS)) {
    if (name.includes(key)) return color;
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

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
      {message.includes('tidak tersedia') && (
        <p className="text-xs mt-2 text-red-500">
          Database perawi hanya tersedia di server produksi.
        </p>
      )}
    </div>
  </div>
);

const InfoBanner = () => (
  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mt-4">
    <Info className="shrink-0 mt-0.5" size={18} />
    <p className="text-sm">
      Data kamus perawi tersedia di server. Silakan cari nama perawi dalam huruf Arab maupun latin.
    </p>
  </div>
);

// ============================================================
// PROFILE MODAL
// ============================================================
const ProfileModal = ({
  rowa,
  onClose,
  onSearchName,
}: {
  rowa: RowaDetail;
  onClose: () => void;
  onSearchName: (name: string) => void;
}) => {
  const guruList = parseList(rowa.sheok);
  const muridList = parseList(rowa.telmez);
  const kutubList = parseKutub(rowa.kutub);

  const handleNameClick = (name: string) => {
    onClose();
    onSearchName(name);
  };

  const NameLink = ({ name }: { name: string }) => (
    <button
      onClick={() => handleNameClick(name)}
      className="w-full text-right flex items-center justify-between group gap-2 py-1.5 border-b border-gray-100 last:border-0 hover:text-[var(--app-primary)] transition-colors"
      title={`Cari "${name}"`}
    >
      <span
        className="text-sm text-gray-700 group-hover:text-[var(--app-primary)] leading-snug"
        dir="rtl"
        style={{ fontFamily: 'var(--arabic-font)' }}
      >
        {name}
      </span>
      <ExternalLink size={12} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity text-[var(--app-primary)]" />
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 flex justify-center items-end sm:items-center p-0 sm:p-4 z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--app-primary)] text-white p-5 flex justify-between items-start gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              className="text-2xl sm:text-3xl font-bold leading-snug"
              dir="rtl"
              style={{ fontFamily: 'var(--arabic-font)' }}
            >
              {rowa.Name}
            </h2>
            {rowa.A_esm && rowa.A_esm !== rowa.Name && (
              <p className="text-sm mt-1 text-white/80 leading-snug" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                {rowa.A_esm}
              </p>
            )}
            {rowa.A_kona && (
              <p className="text-xs mt-1 text-white/70" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                كنيته: {rowa.A_kona}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Info Dasar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Nasab', val: rowa.A_nasab },
              { label: 'Kunyah', val: rowa.A_kona },
              { label: 'Tahun Lahir', val: formatYear(rowa.birth) !== '?' ? `${formatYear(rowa.birth)} H` : null },
              { label: 'Tahun Wafat', val: formatYear(rowa.death) !== '?' ? `${formatYear(rowa.death)} H` : null },
            ].filter(item => item.val).map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <span className="block text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">{item.label}</span>
                <div className="text-sm font-bold text-gray-800 leading-snug" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>

          {/* Nama Kitab */}
          {kutubList.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <BookOpen size={15} className="text-[var(--app-primary)]" /> Kitab yang Meriwayatkan
              </h3>
              <div className="flex flex-wrap gap-2">
                {kutubList.map((k, i) => (
                  <span
                    key={i}
                    className={`text-xs px-3 py-1 rounded-full border font-medium ${getKitabColor(k)}`}
                    dir="rtl"
                    style={{ fontFamily: 'var(--arabic-font)' }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Derajat */}
          {(rowa.ROTBA || rowa.R_ZAHBI) && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <span className="w-5 h-5 bg-[var(--app-primary)] text-white rounded-full flex items-center justify-center text-xs">★</span>
                Penilaian Ulama
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rowa.ROTBA && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <span className="block text-xs text-green-600 font-bold mb-2 uppercase">Ibnu Hajar (Taqrib)</span>
                    <p className="text-base text-green-900 leading-relaxed" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                      {rowa.ROTBA}
                    </p>
                  </div>
                )}
                {rowa.R_ZAHBI && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <span className="block text-xs text-blue-600 font-bold mb-2 uppercase">Adh-Dhahabi</span>
                    <p className="text-base text-blue-900 leading-relaxed" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                      {rowa.R_ZAHBI}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Guru & Murid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Guru */}
            <div>
              <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <GraduationCap size={15} className="text-[var(--app-primary)]" />
                Guru-guru (Syuyukh)
                {guruList.length > 0 && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{guruList.length}</span>
                )}
              </h4>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 max-h-64 overflow-y-auto">
                {guruList.length > 0 ? (
                  <div className="space-y-0">
                    {guruList.map((g, idx) => (
                      <NameLink key={idx} name={g} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
                )}
              </div>
              {guruList.length > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Klik nama untuk mencari profil guru
                </p>
              )}
            </div>

            {/* Murid */}
            <div>
              <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Users size={15} className="text-[var(--app-primary)]" />
                Murid-murid (Talamidz)
                {muridList.length > 0 && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{muridList.length}</span>
                )}
              </h4>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 max-h-64 overflow-y-auto">
                {muridList.length > 0 ? (
                  <div className="space-y-0">
                    {muridList.map((m, idx) => (
                      <NameLink key={idx} name={m} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
                )}
              </div>
              {muridList.length > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Klik nama untuk mencari profil murid
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

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
              placeholder="Cari nama perawi... (contoh: مالك بن أنس atau Malik)"
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
        <InfoBanner />
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
            // Tampilkan A_esm hanya jika berbeda dari Name
            const showFullName = r.A_esm && r.A_esm.trim() !== '' && r.A_esm !== r.Name;

            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 hover:border-[var(--app-primary)]/30 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Nama utama (Name field) */}
                    <h3
                      className="text-xl font-bold text-gray-900 mb-0.5 leading-snug"
                      dir="rtl"
                      style={{ fontFamily: 'var(--arabic-font)' }}
                    >
                      {r.Name}
                    </h3>

                    {/* Nama lengkap (A_esm) jika berbeda */}
                    {showFullName && (
                      <p
                        className="text-sm text-gray-500 mb-1 leading-snug"
                        dir="rtl"
                        style={{ fontFamily: 'var(--arabic-font)' }}
                      >
                        {r.A_esm}
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
        <ProfileModal
          rowa={selectedRowa}
          onClose={() => setSelectedRowa(null)}
          onSearchName={handleSearchFromModal}
        />
      )}
    </div>
  );
};

export default RowaDictionary;
