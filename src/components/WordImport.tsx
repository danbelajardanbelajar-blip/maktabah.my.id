import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileText, ListTree, Upload } from 'lucide-react';

// Admin: turn a Word (.docx) file into a new book. The server reads the file twice: once for a preview
// (nothing stored) and once to import with the title, author and category chosen here.

type Preview = {
  guessedTitle: string; pages: number; titles: number; footnotes: number; characters: number; warnings: string[];
  toc: {page: number; lvl: number; tit: string}[]; sample: {page: number; text: string}[];
};
type Split = 'heading' | 'word';
const MAX_BYTES = 25 * 1024 * 1024;
const arabic = {fontFamily: 'var(--arabic-font)'};

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
  reader.readAsDataURL(file);
});

export function WordImport({ token, categories, onLogout, onChanged, onBusyChange }: {
  token: string; categories: {id: number; name: string}[]; onLogout: () => void; onChanged: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState('');
  const [split, setSplit] = useState<Split>('heading');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusyState] = useState<'' | 'reading' | 'importing'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{bkid: number; title: string; pages: number; titles: number; backup: string} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setBusy = (value: '' | 'reading' | 'importing') => { setBusyState(value); onBusyChange(Boolean(value)); };

  const post = async (action: 'preview' | 'import', body: object) => {
    const r = await fetch(`/api/admin/books/word/${action}`, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
    if (r.status === 401) { onLogout(); throw new Error('Sesi berakhir. Silakan login kembali.'); }
    const json = await r.json().catch(() => null);
    if (!r.ok) throw new Error(json?.error || (r.status === 413 ? 'File terlalu besar.' : `Permintaan gagal (${r.status}).`));
    return json;
  };

  const loadPreview = async (dataUrl: string, picked: File, mode: Split) => {
    setBusy('reading'); setError(''); setPreview(null); setConfirmed(false);
    try {
      const result: Preview = await post('preview', {data:dataUrl, fileName:picked.name, split:mode});
      setPreview(result);
      setTitle(current => current || result.guessedTitle);
    } catch (e) { setError(e instanceof Error ? e.message : 'Pratinjau gagal.'); }
    finally { setBusy(''); }
  };

  const pick = async (picked?: File | null) => {
    setDone(null); setError('');
    if (!picked) return;
    if (!/\.docx$/i.test(picked.name)) { setError(/\.doc$/i.test(picked.name) ? 'File .doc lama belum didukung. Buka di Word lalu Simpan Sebagai .docx.' : 'Pilih file Word berformat .docx.'); return; }
    if (picked.size > MAX_BYTES) { setError('Ukuran file Word maksimal 25 MB.'); return; }
    setFile(picked); setTitle(''); setPreview(null);
    try {
      const dataUrl = await readAsDataUrl(picked);
      setData(dataUrl);
      await loadPreview(dataUrl, picked, split);
    } catch (e) { setError(e instanceof Error ? e.message : 'File tidak dapat dibaca.'); }
  };

  const changeSplit = (mode: Split) => { setSplit(mode); if (file && data) void loadPreview(data, file, mode); };

  const importBook = async () => {
    if (!file || !preview || !confirmed) return;
    setBusy('importing'); setError('');
    try {
      const result = await post('import', {data, fileName:file.name, split, title, author, categoryId:Number(categoryId)});
      setDone(result); setFile(null); setData(''); setPreview(null); setTitle(''); setAuthor(''); setConfirmed(false);
      if (inputRef.current) inputRef.current.value = '';
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import gagal.'); }
    finally { setBusy(''); }
  };

  const onDrop = (e: DragEvent) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); void pick(f); } };
  const field = 'w-full min-h-11 rounded-xl border bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)] disabled:opacity-60';
  const ready = Boolean(preview && title.trim() && categoryId && confirmed && !busy);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gray-50 border p-4 text-sm text-gray-600 leading-relaxed">
        Ubah file <strong>Word (.docx)</strong> menjadi kitab baru. Judul yang memakai style <strong>Heading 1/2/3</strong> menjadi daftar isi dan memulai halaman baru; <em>page break</em> juga memulai halaman baru; catatan kaki ditaruh di bawah halamannya. Database dicadangkan otomatis sebelum kitab disimpan.
      </div>

      {error && <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 flex gap-2 text-sm"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
      {done && <div role="status" className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 flex gap-2 text-sm break-words"><CheckCircle2 size={18} className="shrink-0" />
        <span>Kitab <strong dir="auto">{done.title}</strong> tersimpan dengan ID {done.bkid}: {done.pages} halaman, {done.titles} judul daftar isi. Cadangan otomatis: {done.backup}.</span></div>}

      <label onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
        <FileText size={36} className="text-[var(--app-primary)]" aria-hidden="true" />
        <span className="font-semibold text-gray-800">{file ? 'Ganti file Word' : 'Pilih atau seret file Word'}</span>
        <span className="text-xs text-gray-500">.docx · maksimal 25 MB</span>
        {file && <span dir="auto" className="text-sm text-gray-700 break-all">{file.name}</span>}
        <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={Boolean(busy)} onChange={e => void pick(e.target.files?.[0])} />
      </label>

      <fieldset className="space-y-2" disabled={Boolean(busy)}>
        <legend className="text-sm font-semibold text-gray-700 mb-1">Pembagian halaman</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {([['heading', 'Per judul', 'Halaman baru di setiap Heading dan page break, lalu tiap ±4.000 karakter.'], ['word', 'Ikuti halaman Word', 'Sama dengan halaman di Word (jika file disimpan dari Microsoft Word).']] as const).map(([value, label, hint]) => (
            <label key={value} className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${split === value ? 'border-[var(--app-primary)] bg-emerald-50' : 'bg-white'}`}>
              <input type="radio" name="word-split" className="mt-1 accent-[var(--app-primary)]" checked={split === value} onChange={() => changeSplit(value)} />
              <span><span className="block font-semibold text-sm text-gray-800">{label}</span><span className="block text-xs text-gray-500">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {busy === 'reading' && <p role="status" className="text-sm text-gray-500">Membaca dokumen Word…</p>}

      {preview && <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[['Halaman', preview.pages], ['Judul daftar isi', preview.titles], ['Catatan kaki', preview.footnotes], ['Karakter', preview.characters]].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-lg font-bold text-gray-800">{Number(value).toLocaleString('id-ID')}</div></div>
          ))}
        </div>
        {preview.warnings.map(w => <div key={w} className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 flex gap-2 text-sm"><AlertTriangle size={18} className="shrink-0" />{w}</div>)}

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="border rounded-xl overflow-hidden" aria-label="Pratinjau daftar isi">
            <h3 className="flex items-center gap-2 font-bold text-gray-800 px-4 py-3 border-b bg-gray-50"><ListTree size={17} /> Daftar isi</h3>
            {preview.toc.length ? <ol className="max-h-72 overflow-y-auto divide-y" dir="rtl">
              {preview.toc.map(t => <li key={t.page} className="flex items-baseline gap-3 px-4 py-2" style={{paddingInlineStart:`${1 + (t.lvl - 1) * 1.25}rem`}}>
                <span className="flex-1 text-lg leading-snug" style={arabic} dir="auto">{t.tit}</span><span className="text-xs text-gray-400 shrink-0" dir="ltr">hal {t.page}</span></li>)}
            </ol> : <p className="p-4 text-sm text-gray-500">Tidak ada judul.</p>}
            {preview.titles > preview.toc.length && <p className="px-4 py-2 text-xs text-gray-500 border-t">Menampilkan {preview.toc.length} dari {preview.titles} judul.</p>}
          </section>
          <section className="border rounded-xl overflow-hidden" aria-label="Pratinjau halaman">
            <h3 className="flex items-center gap-2 font-bold text-gray-800 px-4 py-3 border-b bg-gray-50"><FileText size={17} /> Halaman awal</h3>
            <div className="max-h-72 overflow-y-auto divide-y">
              {preview.sample.map(p => <div key={p.page} className="p-4">
                <div className="text-xs text-gray-400 mb-1">Halaman {p.page}</div>
                {p.text.split('\r').map((line, i) => <p key={i} dir="auto" className="text-lg leading-loose whitespace-pre-wrap break-words min-h-[1em]" style={arabic}>{line}</p>)}
              </div>)}
            </div>
          </section>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-gray-700 sm:col-span-2">Judul kitab
            <input dir="auto" value={title} onChange={e => setTitle(e.target.value)} maxLength={300} disabled={Boolean(busy)} className={`${field} mt-1 text-lg`} style={arabic} /></label>
          <label className="block text-sm font-semibold text-gray-700">Penulis <span className="font-normal text-gray-400">(opsional)</span>
            <input dir="auto" value={author} onChange={e => setAuthor(e.target.value)} maxLength={200} disabled={Boolean(busy)} placeholder="Nama penulis" className={`${field} mt-1`} />
            <span className="block text-xs font-normal text-gray-500 mt-1">Penulis dengan nama yang sama persis dipakai ulang.</span></label>
          <label className="block text-sm font-semibold text-gray-700">Kategori
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={Boolean(busy)} className={`${field} mt-1`}>
              <option value="">Pilih kategori…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        </div>
        <label className="flex gap-2 items-start text-sm text-gray-700"><input type="checkbox" className="mt-1 w-4 h-4 accent-[var(--app-primary)]" checked={confirmed} disabled={Boolean(busy)} onChange={e => setConfirmed(e.target.checked)} />
          <span>Saya sudah memeriksa pratinjau, judul, dan kategori kitab ini.</span></label>
        <button type="button" onClick={() => void importBook()} disabled={!ready}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 min-h-11 text-sm font-semibold bg-[var(--app-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed">
          <Upload size={16} />{busy === 'importing' ? 'Mencadangkan dan menyimpan…' : 'Import sebagai kitab baru'}
        </button>
      </>}
    </div>
  );
}
