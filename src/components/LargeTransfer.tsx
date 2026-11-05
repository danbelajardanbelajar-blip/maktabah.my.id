import { useEffect, useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Job = {
  id: string; kind: 'import' | 'export'; status: string; error?: string; downloadUrl?: string;
  progress?: { phase?: string; totalBooks?: number; booksDone?: number; totalPages?: number; pagesDone?: number };
  result?: { books?: number; pages?: number; bytes?: number; imported?: number; skipped?: number; importedCategories?: number; backup?: string; categories?: { id: number; name: string }[]; previewBooks?: { bkid: number; bk: string }[] };
};
const storageKey = 'maktabah-large-transfer-job';
const formatBytes = (size = 0) => `${(size / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;

export function LargeTransfer({ token, mode, selection, onLogout, onChanged, onBusyChange }: {
  token: string; mode: 'export' | 'import'; selection: { bookIds?: number[]; categoryIds?: number[] };
  onLogout: () => void; onChanged: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [jobId, setJobId] = useState(() => localStorage.getItem(storageKey) || '');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [starting, setStarting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const completed = useRef('');
  const busy = starting || uploading || job?.status === 'running' || job?.status === 'uploading';
  useEffect(() => { onBusyChange(Boolean(busy)); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!jobId) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await fetch(`/api/admin/large-transfer/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (r.status === 401) { onLogout(); return; }
        const data = await r.json();
        if (!current) return;
        if (!r.ok) { setError(data.error || 'Status transfer tidak dapat dibaca.'); localStorage.removeItem(storageKey); setJobId(''); setJob(null); return; }
        setJob(data);
        if (data.status === 'done' && completed.current !== data.id) { completed.current = data.id; onChanged(); }
        if (data.status === 'running' || data.status === 'uploading') timer = setTimeout(poll, 1000);
      } catch { if (current) { setError('Koneksi status terputus. Proses di server tetap berjalan; mencoba kembali...'); timer = setTimeout(poll, 3000); } }
    };
    void poll();
    return () => { current = false; clearTimeout(timer); };
  }, [jobId, token, onLogout, onChanged, pollVersion]);
  const remember = (data: Job) => { setJob(data); setJobId(data.id); localStorage.setItem(storageKey, data.id); setConfirmed(false); };
  const post = async (url: string, body?: unknown) => {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const data = await r.json();
    if (r.status === 401) onLogout();
    if (!r.ok) throw new Error(data.error || `Permintaan gagal (${r.status}).`);
    return data as Job;
  };
  const startExport = async () => {
    setStarting(true); setError('');
    try { remember(await post('/api/admin/large-transfer/export', selection)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Export gagal dimulai.'); }
    finally { setStarting(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError(''); setConfirmed(false); setUploading(true); setUploadPercent(0); setJob(null); setJobId(''); localStorage.removeItem(storageKey);
    try {
      const data = await new Promise<Job>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/large-transfer/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.responseType = 'json';
        xhr.upload.onprogress = event => { if (event.lengthComputable) setUploadPercent(Math.round(event.loaded / event.total * 100)); };
        xhr.onerror = () => reject(new Error('Upload terputus. Pastikan memakai alamat HTTPS web online dan ulangi upload.'));
        xhr.onabort = () => reject(new Error('Upload dibatalkan.'));
        xhr.onload = () => {
          if (xhr.status === 401) onLogout();
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
          else reject(new Error(xhr.response?.error || `Upload gagal (${xhr.status}).`));
        };
        xhr.send(file);
      });
      remember(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload gagal.'); }
    finally { setUploading(false); }
  };
  const startImport = async () => {
    if (!job || !confirmed) return;
    setStarting(true); setError('');
    try {
      const data = await post(`/api/admin/large-transfer/jobs/${job.id}/import`);
      setJob(data);
      // Restart status polling even when reusing the uploaded job ID.
      setPollVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import gagal dimulai.'); }
    finally { setStarting(false); }
  };
  const progress = job?.progress;
  const phase = ({ export: 'Menulis paket export', validate: 'Memeriksa paket', backup: 'Membuat cadangan database', import: 'Mengimport kitab dan halaman' } as Record<string, string>)[progress?.phase || ''] || 'Menyiapkan proses';
  return <div className="border rounded-xl bg-green-50/40 p-4 space-y-4">
    <div><h3 className="font-bold text-gray-800">Paket file besar (.db)</h3><p className="text-sm text-gray-600 mt-1">Tanpa batas 50 MB. Paket hanya berisi kitab/kategori pilihan, bukan seluruh database sumber. Proses berjalan di latar belakang dan memakai disk secara bertahap. Kapasitas disk tetap diperiksa.</p></div>
    {error && <p role="alert" className="text-sm text-red-700 flex gap-2"><AlertTriangle size={18} className="shrink-0" />{error}</p>}
    {mode === 'export' ? <button disabled={busy || !(selection.bookIds?.length || selection.categoryIds?.length)} onClick={startExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--app-primary)] text-white font-semibold text-sm disabled:opacity-50"><Download size={16} /> Export pilihan sebagai .db</button>
      : <label className="block text-sm font-semibold text-gray-700">Upload file .db hasil export mode file besar<input type="file" accept=".db,application/vnd.sqlite3,application/x-sqlite3" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); }} className="block mt-2 w-full font-normal" /></label>}
    {uploading && <div role="status"><p className="text-sm">Mengunggah file: {uploadPercent}%</p><progress value={uploadPercent} max={100} className="w-full" /><p className="text-xs text-gray-500">Biarkan halaman terbuka sampai upload selesai. Setelah itu pemrosesan berlangsung di server.</p></div>}
    {job && <div className="bg-white rounded-lg border p-4 space-y-3" aria-live="polite">
      {job.status === 'running' && <><p className="font-semibold text-sm">{phase}…</p>{progress?.totalBooks !== undefined && <p className="text-sm text-gray-600">{progress.booksDone || 0} / {progress.totalBooks} kitab · {(progress.pagesDone || 0).toLocaleString('id-ID')} / {(progress.totalPages || 0).toLocaleString('id-ID')} halaman</p>}<p className="text-xs text-gray-500">Proses tetap berjalan bila halaman direfresh. Status akan dimuat kembali.</p></>}
      {job.status === 'failed' && <p role="alert" className="text-sm text-red-700">{job.error || 'Transfer gagal.'}</p>}
      {job.status === 'ready' && job.kind === 'export' && <><p className="font-semibold text-green-800">Export selesai: {job.result?.books} kitab · {job.result?.pages?.toLocaleString('id-ID')} halaman · {formatBytes(job.result?.bytes)}</p><a href={job.downloadUrl || '#'} className="inline-flex items-center gap-2 bg-[var(--app-primary)] text-white px-4 py-2 rounded-lg font-semibold text-sm"><Download size={16} /> Unduh paket .db</a><p className="text-xs text-gray-500">Tautan unduhan tersedia selama 24 jam.</p></>}
      {job.status === 'ready' && job.kind === 'import' && <><h4 className="font-bold">Pratinjau paket</h4><p className="text-sm">{job.result?.categories?.length} kategori · {job.result?.books} kitab · {job.result?.pages?.toLocaleString('id-ID')} halaman · {formatBytes(job.result?.bytes)}</p><p className="text-sm text-gray-600">{job.result?.categories?.map(c => c.name).join(' · ')}</p><ul className="max-h-40 overflow-auto text-sm space-y-1">{job.result?.previewBooks?.map(b => <li key={b.bkid} dir="auto">{b.bk}</li>)}</ul><p className="text-xs text-gray-500">Ditampilkan hingga 30 judul pertama. Kitab dengan ID yang sudah ada dilewati. Cadangan dibuat sebelum import; jika terjadi kegagalan, seluruh penambahan dibatalkan.</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} className="mt-1" />Saya sudah memeriksa paket dan ingin mengimportnya.</label><button onClick={startImport} disabled={!confirmed || busy} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--app-primary)] text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Upload size={16} /> Mulai import</button></>}
      {job.status === 'done' && <p className="text-sm text-green-800 flex gap-2"><CheckCircle2 size={18} className="shrink-0" />{job.result?.importedCategories} kategori baru, {job.result?.imported} kitab, dan {job.result?.pages?.toLocaleString('id-ID')} halaman diimport. {job.result?.skipped} kitab dilewati. Cadangan: {job.result?.backup}.</p>}
    </div>}
  </div>;
}
