import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export function AiSettings({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-flash-latest');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    fetch('/api/admin/ai-settings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then(async r => {
      if (r.status === 401) { onLogout(); return; }
      if (!r.ok) throw new Error('Pengaturan AI belum dapat dimuat.');
      const data = await r.json(); if (current) { setConfigured(data.configured); setModel(data.model); }
    }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, onLogout]);
  const submit = async (save: boolean) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch(`/api/admin/ai-settings${save ? '' : '/test'}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim(), model }) });
      if (r.status === 401) onLogout();
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Koneksi Gemini belum berhasil.');
      setMessage(data.message);
      if (save) { setConfigured(true); setApiKey(''); setModel(data.model); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Pengaturan belum dapat diproses.'); }
    finally { setBusy(false); }
  };
  return <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-5 max-w-2xl mx-auto">
    <h2 className="font-bold text-xl text-gray-800 flex gap-2 items-center"><Bot />Pengaturan Tanya AI</h2>
    <p className="text-sm text-gray-600">Hubungkan Gemini agar Tanya AI dapat menyusun jawaban dari rujukan kitab. Koneksi diuji sebelum pengaturan disimpan.</p>
    <p className={`text-sm font-semibold ${configured ? 'text-emerald-700' : 'text-amber-800'}`}>{loading ? 'Memuat pengaturan…' : configured ? 'API key sudah dikonfigurasi. Gunakan Uji koneksi untuk memeriksanya.' : 'Belum aktif: API key Gemini belum diatur.'}</p>
    <p className="text-sm text-gray-600">Belum punya kunci? <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-emerald-700 underline">Buat API key di Google AI Studio</a>, lalu masukkan di bawah.</p>
    {message && <p role="status" className="text-emerald-800 bg-emerald-50 rounded-lg p-3 text-sm flex gap-2"><CheckCircle2 size={18} className="shrink-0" />{message}</p>}
    {error && <p role="alert" className="text-red-700 bg-red-50 rounded-lg p-3 text-sm flex gap-2"><AlertTriangle size={18} className="shrink-0" />{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void submit(true); }} className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700">API key Gemini
        <input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={busy || loading} maxLength={150} placeholder={configured ? 'Kosongkan untuk memakai kunci tersimpan' : 'Masukkan API key dari Google AI Studio'} className="block w-full border rounded-lg px-3 py-2 mt-2 font-normal" />
      </label>
      <p className="text-xs text-gray-500">Kunci hanya disimpan di konfigurasi privat VPS. Kunci tersimpan tidak ditampilkan kembali dan tidak masuk GitHub.</p>
      <label className="block text-sm font-semibold text-gray-700">Model Gemini
        <input value={model} onChange={e => setModel(e.target.value)} disabled={busy || loading} maxLength={80} required className="block w-full border rounded-lg px-3 py-2 mt-2 font-normal" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || loading || (!configured && !apiKey.trim())} className="bg-emerald-700 text-white rounded-lg px-4 py-2 font-semibold text-sm disabled:opacity-50 flex gap-2 items-center">{busy && <Loader2 size={16} className="animate-spin" />}Simpan &amp; uji koneksi</button>
        <button type="button" onClick={() => submit(false)} disabled={busy || loading || (!configured && !apiKey.trim())} className="border rounded-lg px-4 py-2 font-semibold text-sm disabled:opacity-50">Uji koneksi</button>
      </div>
    </form>
  </section>;
}
