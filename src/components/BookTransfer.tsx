import { useEffect, useState } from 'react';
import { Download, Upload, Search, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { webAPI } from '../api';

type Book = { bkid: number; bk: string; cat_name: string };
type Package = { format: string; version: number; books: { book: { bkid: number; bk: string }; pages: unknown[]; titles: unknown[] }[] };
const LIMIT = 50 * 1024 * 1024;
const saveFile = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function BookTransfer({ token, onLogout, onBack, onChanged }: {
  token: string; onLogout: () => void; onBack: () => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<Map<number, Book>>(new Map());
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState<Package | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let current = true;
    webAPI.getAdminCategories(token).then(r => { if (current) setCategories(r.data); }).catch(e => {
      if (current) { if (e.message === '401') onLogout(); else setError('Gagal memuat kategori.'); }
    });
    return () => { current = false; };
  }, [token, refresh, onLogout]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    const timer = setTimeout(() => {
      webAPI.getAdminBooks(token, page, query, cat ? Number(cat) : undefined, 20).then(r => {
        if (current) { setBooks(r.data); setTotal(r.total); }
      }).catch(e => {
        if (current) { if (e.message === '401') onLogout(); else setError('Gagal memuat daftar kitab.'); }
      }).finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [token, page, query, cat, refresh, onLogout]);

  const request = async (endpoint: string, body: unknown) => {
    const r = await fetch(`/api/admin/books/${endpoint}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.status === 401) { onLogout(); throw new Error('Sesi berakhir. Silakan login kembali.'); }
    if (!r.ok) {
      const detail = await r.json().catch(() => null);
      throw new Error(detail?.error || `Permintaan gagal (${r.status}).`);
    }
    return r;
  };

  const exportSelected = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await request('export', { bookIds: [...selected.keys()] });
      saveFile(await r.blob(), `maktabah-kitab-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage(`${selected.size} kitab berhasil diexport beserta halaman dan daftar isinya.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export gagal.'); }
    finally { setBusy(false); }
  };

  const readFile = async (file?: File) => {
    setPayload(null); setConfirmed(false); setError(''); setMessage(''); setFileName(file?.name || '');
    if (!file) return;
    setReading(true);
    try {
      if (file.size > LIMIT) throw new Error('Ukuran file melebihi batas 50 MB.');
      const data: Package = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (data.format !== 'maktabah-books' || data.version !== 1 || !Array.isArray(data.books)
        || !data.books.length || data.books.length > 100
        || data.books.some(item => !item.book || typeof item.book.bk !== 'string' || !Array.isArray(item.pages) || !Array.isArray(item.titles))) {
        throw new Error('Pilih file JSON hasil export kitab Maktabah (versi 1, maksimal 100 kitab).');
      }
      setPayload(data);
    } catch (e) { setError(e instanceof SyntaxError ? 'File bukan JSON yang valid.' : e instanceof Error ? e.message : 'File tidak dapat dibaca.'); }
    finally { setReading(false); }
  };

  const importFile = async () => {
    if (!payload || !confirmed) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await request('import', payload);
      const result = await r.json();
      setMessage(`${result.imported} kitab dan ${result.pages} halaman berhasil diimport. ${result.skipped.length} kitab dilewati karena ID sudah ada. Cadangan otomatis: ${result.backup}.`);
      setPayload(null); setConfirmed(false); setRefresh(v => v + 1); setSelected(new Map()); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import gagal.'); }
    finally { setBusy(false); }
  };

  const toggle = (book: Book) => setSelected(previous => {
    const next = new Map(previous);
    if (next.has(book.bkid)) next.delete(book.bkid);
    else if (next.size < 100) next.set(book.bkid, book);
    return next;
  });
  const button = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
  return <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold text-xl text-gray-800">Import / Export Kitab</h2><p className="text-sm text-gray-500 mt-1">Pindahkan kitab pilihan beserta penulis, kategori, isi halaman, dan daftar isi.</p></div>
      <button className={`${button} bg-gray-100 text-gray-700`} onClick={onBack} disabled={busy}><ArrowLeft size={16} /> Database Kitab</button>
    </div>
    <div className="flex border-b px-5 gap-5" role="tablist" aria-label="Transfer kitab">
      {(['export', 'import'] as const).map(value => <button key={value} role="tab" aria-selected={tab === value} disabled={busy} onClick={() => { setTab(value); setError(''); setMessage(''); }} className={`py-3 border-b-2 font-semibold text-sm ${tab === value ? 'border-[var(--app-primary)] text-[var(--app-primary)]' : 'border-transparent text-gray-500'}`}>{value === 'export' ? 'Export Kitab' : 'Import Kitab'}</button>)}
    </div>
    <div className="p-5 space-y-4">
      {error && <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 flex gap-2 text-sm"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
      {message && <div role="status" className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 flex gap-2 text-sm break-words"><CheckCircle2 size={18} className="shrink-0" />{message}</div>}
      {tab === 'export' ? <>
        <div className="rounded-xl bg-gray-50 border p-4 text-sm text-gray-600">Pilih maksimal 100 kitab dari database utama. File JSON mencakup seluruh halaman kitab, bukan hanya halaman yang tampil. Batas export 50 MB per file.</div>
        <div className="flex flex-col md:flex-row gap-3">
          <label className="flex items-center gap-2 border rounded-lg px-3 flex-1"><Search size={17} className="text-gray-400" /><input aria-label="Cari judul kitab" className="w-full py-2 outline-none" placeholder="Cari judul kitab..." value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
          <select aria-label="Filter kategori kitab" value={cat} disabled={busy} onChange={e => { setCat(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 md:max-w-64"><option value="">Semua kategori</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3"><span className="text-sm font-semibold text-gray-600">{selected.size} / 100 kitab dipilih</span><div className="flex gap-2"><button onClick={() => setSelected(new Map())} disabled={!selected.size || busy} className={`${button} text-gray-600 bg-gray-100`}>Kosongkan pilihan</button><button onClick={exportSelected} disabled={!selected.size || busy} className={`${button} bg-[var(--app-primary)] text-white`}><Download size={16} />{busy ? 'Menyiapkan file...' : 'Export pilihan'}</button></div></div>
        <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3 w-10">Pilih</th><th className="p-3">ID</th><th className="p-3">Judul kitab</th><th className="p-3">Kategori</th></tr></thead><tbody className="divide-y">
          {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Memuat kitab...</td></tr> : !books.length ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Tidak ada kitab yang cocok.</td></tr> : books.map(b => <tr key={b.bkid} className="hover:bg-gray-50"><td className="p-3"><input type="checkbox" aria-label={`Pilih ${b.bk}`} checked={selected.has(b.bkid)} disabled={busy || (!selected.has(b.bkid) && selected.size >= 100)} onChange={() => toggle(b)} /></td><td className="p-3 text-gray-400">{b.bkid}</td><td dir="auto" className="p-3 text-lg" style={{ fontFamily: 'var(--arabic-font)' }}>{b.bk}</td><td dir="auto" className="p-3">{b.cat_name || '—'}</td></tr>)}
        </tbody></table></div>
        <div className="flex justify-between items-center gap-3 text-sm text-gray-500"><span>{total} kitab · Halaman {page} / {Math.max(1, Math.ceil(total / 20))}</span><div className="flex gap-2"><button className={`${button} border`} disabled={page <= 1 || loading || busy} onClick={() => setPage(p => p - 1)}>Sebelumnya</button><button className={`${button} border`} disabled={page * 20 >= total || loading || busy} onClick={() => setPage(p => p + 1)}>Berikutnya</button></div></div>
      </> : <>
        <div className="rounded-xl bg-gray-50 border p-4 text-sm text-gray-600">Gunakan file <strong>.json hasil export Maktabah</strong> (maksimal 50 MB / 100 kitab). Kitab dengan ID yang sudah ada akan dilewati. Database dicadangkan otomatis sebelum import; data yang sudah ada tetap disimpan.</div>
        <label className="block rounded-xl border-2 border-dashed p-6 bg-gray-50 text-sm"><span className="font-semibold block mb-3">Pilih file kitab</span><input type="file" accept=".json,application/json" disabled={busy || reading} onChange={e => { void readFile(e.target.files?.[0]); }} className="block w-full" />{fileName && <span className="block text-gray-500 mt-2 break-all">{fileName}</span>}</label>
        {reading && <p role="status" className="text-sm text-gray-500">Membaca file...</p>}
        {payload && <div className="space-y-4"><div className="border rounded-xl p-4"><h3 className="font-bold text-gray-800 mb-3">Pratinjau: {payload.books.length} kitab · {payload.books.reduce((sum, b) => sum + b.pages.length, 0)} halaman</h3><ul className="space-y-2 max-h-64 overflow-y-auto">{payload.books.map((b, index) => <li key={index} className="flex justify-between gap-3 text-sm border-b pb-2"><span dir="auto">{b.book.bk}</span><span className="text-gray-500 shrink-0">ID {b.book.bkid} · {b.pages.length} halaman</span></li>)}</ul></div><label className="flex gap-2 items-start text-sm text-gray-700"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /><span>Saya sudah memeriksa daftar kitab dan ingin menambahkannya ke database.</span></label><button onClick={importFile} disabled={!confirmed || busy} className={`${button} bg-[var(--app-primary)] text-white`}><Upload size={16} />{busy ? 'Mencadangkan dan mengimport...' : 'Import kitab'}</button></div>}
      </>}
    </div>
  </section>;
}
