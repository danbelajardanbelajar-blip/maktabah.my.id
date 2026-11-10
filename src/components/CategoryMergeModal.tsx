import React, { useState, useEffect, useMemo } from 'react';
import { GitMerge, X, Search, Check, AlertCircle, Loader2, Sparkles, ArrowRight, FolderPlus } from 'lucide-react';
import { webAPI } from '../api';

interface Category {
  id: number;
  name: string;
  catord: number;
  lvl: number;
  book_count: number;
}

interface CategoryMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialSelected: Category[];
  token: string;
  onMerged: (message: string) => void;
  onLogout: () => void;
}

export const CategoryMergeModal: React.FC<CategoryMergeModalProps> = ({
  isOpen,
  onClose,
  categories,
  initialSelected,
  token,
  onMerged,
  onLogout,
}) => {
  const [sources, setSources] = useState<Category[]>([]);
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [deleteSource, setDeleteSource] = useState(true);
  const [targetSearch, setTargetSearch] = useState('');
  const [addSourceSearch, setAddSourceSearch] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');

  // Reset or initialize state when opened
  useEffect(() => {
    if (isOpen) {
      setSources(initialSelected.length > 0 ? [...initialSelected] : []);
      // Jika ada 1 atau lebih sumber, default targetId pilih kategori pertama di luar sumber
      const firstAvailable = categories.find(c => !initialSelected.some(s => s.id === c.id));
      setTargetId(firstAvailable ? firstAvailable.id : null);
      setTargetMode('existing');
      setNewCatName('');
      setDeleteSource(true);
      setError('');
      setTargetSearch('');
      setAddSourceSearch('');
    }
  }, [isOpen, initialSelected, categories]);

  // Hitung total kitab yang akan dipindahkan
  const totalBooksToMove = useMemo(() => {
    return sources.reduce((sum, c) => sum + (c.book_count || 0), 0);
  }, [sources]);

  // Daftar kategori yang tersedia untuk target (tidak boleh yang ada di sources)
  const availableTargets = useMemo(() => {
    const sourceIds = new Set(sources.map(s => s.id));
    return categories
      .filter(c => !sourceIds.has(c.id))
      .filter(c => !targetSearch || c.name.toLowerCase().includes(targetSearch.toLowerCase()) || String(c.id).includes(targetSearch));
  }, [categories, sources, targetSearch]);

  // Daftar kategori yang bisa ditambahkan ke sumber
  const candidatesToAdd = useMemo(() => {
    const sourceIds = new Set(sources.map(s => s.id));
    if (!addSourceSearch.trim()) return [];
    return categories
      .filter(c => !sourceIds.has(c.id))
      .filter(c => c.name.toLowerCase().includes(addSourceSearch.toLowerCase()) || String(c.id).includes(addSourceSearch))
      .slice(0, 8);
  }, [categories, sources, addSourceSearch]);

  // Rekomendasi pasangan kategori serupa yang bisa digabung cepat
  const quickSuggestions = useMemo(() => {
    const suggestions: Array<{ title: string; sourceIds: number[]; targetId: number }> = [];
    const findCat = (id: number) => categories.find(c => c.id === id);

    // Pasangan umum yang serupa
    const pairs = [
      { s: [103], t: 32, label: 'الدواوين الشعرية' },
      { s: [47, 68], t: 12, label: 'أصول الفقه والقواعد الفقهية' },
      { s: [81], t: 31, label: 'الأدب والبلاغة' },
      { s: [28, 57], t: 2, label: 'التفاسير' },
      { s: [41], t: 16, label: 'فقه حنبلي' },
      { s: [73], t: 13, label: 'فقه حنفي' },
      { s: [306], t: 15, label: 'فقه شافعي' },
      { s: [326], t: 14, label: 'فقه مالكي' },
      { s: [309], t: 334, label: 'Piss-Ktb' },
      { s: [55], t: 3, label: 'علوم القرآن' },
    ];

    for (const p of pairs) {
      const targetCat = findCat(p.t);
      const validSources = p.s.map(id => findCat(id)).filter(Boolean) as Category[];
      if (targetCat && validSources.length > 0) {
        suggestions.push({
          title: p.label,
          sourceIds: validSources.map(s => s.id),
          targetId: targetCat.id
        });
      }
    }
    return suggestions.slice(0, 4);
  }, [categories]);

  if (!isOpen) return null;

  const handleRemoveSource = (id: number) => {
    setSources(prev => prev.filter(c => c.id !== id));
  };

  const handleAddSource = (cat: Category) => {
    setSources(prev => [...prev, cat]);
    setAddSourceSearch('');
    // Jika targetId adalah kategori yang baru saja dijadikan sumber, reset targetId
    if (targetId === cat.id) {
      const nextTarget = categories.find(c => c.id !== cat.id && !sources.some(s => s.id === c.id));
      setTargetId(nextTarget ? nextTarget.id : null);
    }
  };

  const applySuggestion = (sug: { sourceIds: number[]; targetId: number }) => {
    const srcCats = categories.filter(c => sug.sourceIds.includes(c.id));
    setSources(srcCats);
    setTargetId(sug.targetId);
    setTargetMode('existing');
  };

  const handleMerge = async () => {
    if (sources.length === 0) {
      setError('Pilih setidaknya satu kategori sumber yang akan digabung.');
      return;
    }
    if (targetMode === 'existing' && !targetId) {
      setError('Pilih kategori tujuan.');
      return;
    }
    if (targetMode === 'new' && !newCatName.trim()) {
      setError('Tuliskan nama kategori baru untuk tujuan penggabungan.');
      return;
    }

    setMerging(true);
    setError('');

    try {
      const res = await webAPI.mergeCategories(token, {
        sourceCategoryIds: sources.map(s => s.id),
        targetCategoryId: targetMode === 'existing' ? targetId : null,
        newCategoryName: targetMode === 'new' ? newCatName.trim() : undefined,
        deleteSourceCategories: deleteSource,
      });

      if (res?.success) {
        onMerged(res.message || 'Penggabungan kategori berhasil diselesaikan.');
        onClose();
      } else {
        setError(res?.error || 'Gagal menggabungkan kategori.');
      }
    } catch (err: any) {
      if (err.message === '401') onLogout();
      else setError(err.message || 'Terjadi kesalahan saat memproses penggabungan.');
    } finally {
      setMerging(false);
    }
  };

  const targetCategoryObj = categories.find(c => c.id === targetId);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-gray-100">
        
        {/* Header Modal */}
        <div className="p-5 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <GitMerge size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Gabungkan Kategori & Kitab (Merge)</h2>
              <p className="text-xs text-gray-500">Pindahkan seluruh kitab dari beberapa kategori ke satu kategori tujuan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={merging}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-black/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Saran Cepat jika belum banyak sumber dipilih */}
          {sources.length === 0 && quickSuggestions.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/70 p-4 rounded-xl space-y-2">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-600" /> Saran Cepat Penggabungan Kategori Serupa:
              </p>
              <div className="flex flex-wrap gap-2">
                {quickSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applySuggestion(sug)}
                    className="text-xs bg-white hover:bg-amber-100/70 text-gray-800 border border-amber-300 px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{sug.title}</span>
                    <ArrowRight size={12} className="text-amber-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Kategori Sumber (Yang Digabung) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
                1. Kategori Sumber ({sources.length} kategori dipilih)
              </label>
              {sources.length > 0 && (
                <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {totalBooksToMove} kitab akan dipindahkan
                </span>
              )}
            </div>

            {sources.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl text-center text-sm text-gray-500">
                Belum ada kategori sumber yang dipilih. Cari kategori di bawah atau pilih dari tabel sebelumnya.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border rounded-xl max-h-40 overflow-y-auto">
                {sources.map(s => (
                  <div
                    key={s.id}
                    className="inline-flex items-center gap-2 bg-white border border-gray-200 shadow-2xs text-gray-800 px-3 py-1.5 rounded-lg text-sm"
                  >
                    <span className="text-xs font-bold text-gray-400">#{s.id}</span>
                    <span className="font-semibold" dir="auto">{s.name}</span>
                    <span className="bg-amber-500/10 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded">
                      {s.book_count} kitab
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSource(s.id)}
                      disabled={merging}
                      className="text-gray-400 hover:text-red-500 ml-1"
                      title="Hapus dari sumber"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tambah Kategori Sumber Tambahan */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={addSourceSearch}
                onChange={e => setAddSourceSearch(e.target.value)}
                placeholder="Cari kategori lain untuk ditambahkan ke sumber..."
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:border-amber-500"
              />
              {candidatesToAdd.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {candidatesToAdd.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleAddSource(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 flex items-center justify-between gap-2"
                    >
                      <span className="font-semibold text-gray-800" dir="auto">#{c.id} {c.name}</span>
                      <span className="text-gray-500 text-2xs">{c.book_count} kitab</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Kategori Tujuan (Target) */}
          <div className="space-y-3 pt-2 border-t">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
              2. Kategori Tujuan (Kitab akan dipindahkan ke sini)
            </label>

            {/* Pilihan: Kategori yang ada atau baru */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('existing')}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  targetMode === 'existing'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Check size={14} className={targetMode === 'existing' ? 'opacity-100' : 'opacity-0'} />
                Pilih Kategori yang Ada
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('new')}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  targetMode === 'new'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FolderPlus size={14} />
                Buat Kategori Baru
              </button>
            </div>

            {targetMode === 'existing' ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={targetSearch}
                    onChange={e => setTargetSearch(e.target.value)}
                    placeholder="Saring daftar kategori tujuan..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="border rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-100 bg-gray-50/50">
                  {availableTargets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">Tidak ada kategori yang cocok</div>
                  ) : (
                    availableTargets.map(c => {
                      const isSelected = targetId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setTargetId(c.id)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-amber-100 text-amber-900 font-bold' : 'hover:bg-gray-100 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-2xs text-gray-400 font-mono">#{c.id}</span>
                            <span className="text-sm font-semibold" dir="auto">{c.name}</span>
                          </div>
                          <span className="text-2xs bg-white/80 border px-1.5 py-0.5 rounded text-gray-600">
                            {c.book_count} kitab
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {targetCategoryObj && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600" />
                    Target terpilih: <strong>#{targetCategoryObj.id} {targetCategoryObj.name}</strong> ({targetCategoryObj.book_count} kitab saat ini)
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Ketik nama kategori baru (contoh: كتب التفسير المعتمدة)..."
                  dir="auto"
                  className="w-full px-3 py-2 border-2 border-amber-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <p className="text-2xs text-gray-500">Kategori baru ini akan otomatis dibuat di database saat penggabungan berjalan.</p>
              </div>
            )}
          </div>

          {/* 3. Opsi Tambahan */}
          <div className="pt-2 border-t">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteSource}
                onChange={e => setDeleteSource(e.target.checked)}
                disabled={merging}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Hapus kategori sumber yang sudah kosong setelah seluruh kitab dipindahkan</span>
            </label>
          </div>
        </div>

        {/* Footer Tombol Aksi */}
        <div className="p-4 bg-gray-50 border-t flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleMerge}
            disabled={merging || sources.length === 0 || (targetMode === 'existing' && !targetId) || (targetMode === 'new' && !newCatName.trim())}
            className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {merging ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memproses Penggabungan…</span>
              </>
            ) : (
              <>
                <GitMerge size={16} />
                <span>Gabungkan Sekarang ({totalBooksToMove} Kitab)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
