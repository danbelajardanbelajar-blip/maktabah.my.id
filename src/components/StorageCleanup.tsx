import { useCallback, useEffect, useState } from 'react';
import { Trash2, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

type Plan = {
  planId: string; backupFiles: number; transferFiles: number; reclaimableBytes: number; freeBytes: number;
  retainedBackup: string | null; preservedTransfers: number; removableFiles: number; busy: boolean;
};
const bytes = (n: number) => n >= 1024 ** 3 ? `${(n / 1024 ** 3).toLocaleString('id-ID', { maximumFractionDigits: 2 })} GB`
  : `${(n / 1024 ** 2).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;

export function StorageCleanup({ token, busy, onLogout, onCleaned }: { token: string; busy: boolean; onLogout: () => void; onCleaned: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useCallback(async (method = 'GET', body?: object) => {
    const r = await fetch('/api/admin/storage/cleanup', { method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { onLogout(); throw new Error('Sesi berakhir. Silakan masuk kembali.'); }
    if (r.status === 403) { setHidden(true); return null; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Permintaan gagal (${r.status}).`);
    return data;
  }, [token, onLogout]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setPlan(await request()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal memeriksa penyimpanan.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  const clean = async () => {
    if (!plan || cleaning || busy) return;
    if (!window.confirm(`Hapus ${plan.backupFiles} backup lama dan ${plan.transferFiles} paket transfer sementara (sekitar ${bytes(plan.reclaimableBytes)})? Satu backup terbaru, paket yang masih siap dipakai, dan database kitab tetap disimpan. File yang dihapus tidak dapat dipulihkan.`)) return;
    setCleaning(true); setError(''); setMessage('');
    try {
      const result = await request('POST', { planId: plan.planId });
      if (!result) return;
      setPlan(result);
      setMessage(`${result.deletedFiles} file berhasil dihapus (${bytes(result.freedBytes)}). Ruang kosong sekarang ${bytes(result.freeBytes)}. ${result.retainedBackup ? 'Backup terbaru tetap disimpan.' : 'Database kitab tetap disimpan.'}`);
      if (result.warnings?.length) setError(`Sebagian file belum terhapus: ${result.warnings.join('; ')}`);
      try {
        const key = 'maktabah-large-transfer-job';
        if (result.removedJobIds.includes(localStorage.getItem(key))) localStorage.removeItem(key);
      } catch {}
      onCleaned();
    } catch (e) { setError(e instanceof Error ? e.message : 'Pembersihan belum berhasil dikonfirmasi. Muat ulang perkiraan.'); }
    finally { setCleaning(false); }
  };
  if (hidden) return null;
  return <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold text-gray-800">Bersihkan penyimpanan VPS</h3>
      <button type="button" onClick={load} disabled={loading || cleaning || busy} className="inline-flex items-center gap-2 text-sm text-gray-600 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Perbarui perkiraan</button>
    </div>
    <p className="text-sm text-gray-600">Hapus backup lama dan paket transfer yang selesai, gagal, atau kedaluwarsa. Satu backup terbaru serta paket siap import/unduh yang belum kedaluwarsa tetap disimpan.</p>
    {plan && <p className="text-sm text-gray-700">Ruang kosong: <strong>{bytes(plan.freeBytes)}</strong> · Bisa dibersihkan: <strong>{bytes(plan.reclaimableBytes)}</strong> ({plan.backupFiles} backup lama, {plan.transferFiles} paket transfer).</p>}
    {error && <p role="alert" className="text-sm text-red-700 flex gap-2"><AlertTriangle size={18} className="shrink-0" />{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-800 flex gap-2"><CheckCircle2 size={18} className="shrink-0" />{message}</p>}
    <button type="button" disabled={!plan || !plan.removableFiles || loading || cleaning || busy || plan.busy} onClick={clean} className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
      {cleaning ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{cleaning ? 'Membersihkan…' : 'Bersihkan penyimpanan'}
    </button>
    {(busy || plan?.busy) && <p className="text-sm text-amber-800">Tunggu proses aktif selesai, lalu perbarui perkiraan.</p>}
  </aside>;
}
