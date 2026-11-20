import { useEffect, useState } from 'react';
import { BookMarked, Search, X } from 'lucide-react';
import { webAPI } from '../api';
import { MAX_PICKED_BOOKS, type PickedBook } from '../lib/search-books';

interface TitleRow { bkid: number; bk: string; author_name?: string | null }

/** Picks the books a text search is limited to: find titles, tick them, and switch the limit on or off. */
export function BookPicker({ books, active, advanced, onBooksChange, onActiveChange }: {
  books: PickedBook[]; active: boolean; advanced: boolean;
  onBooksChange: (books: PickedBook[]) => void; onActiveChange: (active: boolean) => void;
}) {
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<TitleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) { setFound([]); setTotal(0); setError(''); return; }
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      webAPI.searchTitles(query, 1, 30, undefined, advanced)
        .then(res => { if (current) { setFound(res.data || []); setTotal(res.total || 0); setError(''); } })
        .catch(e => { if (current) { setFound([]); setError(e.message || 'Gagal mencari judul.'); } })
        .finally(() => { if (current) setLoading(false); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [term, advanced]);

  const picked = new Set(books.map(book => book.bkid));
  const full = books.length >= MAX_PICKED_BOOKS;
  const toggle = (row: TitleRow) => {
    if (picked.has(row.bkid)) { onBooksChange(books.filter(book => book.bkid !== row.bkid)); return; }
    if (full) return;
    onBooksChange([...books, { bkid: row.bkid, bk: row.bk, author: row.author_name || null }]);
    if (!books.length) onActiveChange(true);
  };

  return (
    <div className="mt-5 pt-5 border-t border-black/10">
      <h3 className="font-bold text-[var(--app-primary)] mb-1 flex items-center gap-2">
        <BookMarked size={20} /> Cari di Kitab Tertentu
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Berlaku untuk pencarian <b>Teks</b>. Bila aktif, pencarian hanya di kitab yang dicentang dan filter kategori tidak dipakai. Maksimal {MAX_PICKED_BOOKS} kitab; daftar tersimpan di perangkat ini.
      </p>

      <label className={`flex items-center gap-3 p-3 rounded-xl border mb-3 ${books.length ? 'cursor-pointer bg-white/60' : 'opacity-60'}`}>
        <input type="checkbox" className="w-5 h-5 accent-[var(--app-primary)]" disabled={!books.length}
          checked={active && books.length > 0} onChange={e => onActiveChange(e.target.checked)} />
        <span className="font-semibold text-sm">Cari hanya di {books.length.toLocaleString('id-ID')} kitab terpilih</span>
      </label>

      {books.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-600">Kitab terpilih ({books.length}/{MAX_PICKED_BOOKS})</span>
            <button type="button" onClick={() => { onBooksChange([]); onActiveChange(false); }} className="text-xs font-semibold text-red-600 px-2 py-1 rounded hover:bg-red-50">Kosongkan</button>
          </div>
          <ul className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {books.map(book => (
              <li key={book.bkid} className="flex items-center gap-1 max-w-full rounded-full border bg-[var(--reader-paper)] pl-3 pr-1 py-1 text-sm">
                <span className="truncate" dir="auto" title={book.bk}>{book.bk}</span>
                <button type="button" aria-label={`Hapus ${book.bk}`} onClick={() => onBooksChange(books.filter(item => item.bkid !== book.bkid))} className="shrink-0 p-1 rounded-full hover:bg-black/10"><X size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input type="text" value={term} onChange={e => setTerm(e.target.value)} placeholder="Cari judul kitab untuk dicentang…"
          aria-label="Cari judul kitab" className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-black/10 bg-[var(--reader-paper)] focus:outline-none focus:border-[var(--app-primary)]" dir="auto" />
      </div>
      {loading && <p className="text-xs text-gray-500 mt-2">Mencari judul…</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {!loading && term.trim().length >= 2 && !error && found.length === 0 && <p className="text-xs text-gray-500 mt-2">Judul tidak ditemukan.</p>}
      {full && found.length > 0 && <p className="text-xs text-amber-700 mt-2">Sudah {MAX_PICKED_BOOKS} kitab. Hapus salah satu untuk menambah.</p>}
      {found.length > 0 && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border bg-white/50 divide-y divide-black/5">
          {found.map(row => (
            <label key={row.bkid} className={`flex items-start gap-3 p-2.5 ${!picked.has(row.bkid) && full ? 'opacity-50' : 'cursor-pointer hover:bg-black/5'}`}>
              <input type="checkbox" className="mt-1 w-5 h-5 shrink-0 accent-[var(--app-primary)]" checked={picked.has(row.bkid)}
                disabled={!picked.has(row.bkid) && full} onChange={() => toggle(row)} />
              <span className="min-w-0">
                <span className="block font-semibold break-words" dir="auto">{row.bk}</span>
                {row.author_name && <span className="block text-xs text-gray-500 break-words" dir="auto">{row.author_name}</span>}
              </span>
            </label>
          ))}
          {total > found.length && <p className="p-2 text-xs text-gray-500">Menampilkan {found.length} dari {total.toLocaleString('id-ID')} judul. Ketik judul lebih lengkap untuk mempersempit.</p>}
        </div>
      )}
    </div>
  );
}
