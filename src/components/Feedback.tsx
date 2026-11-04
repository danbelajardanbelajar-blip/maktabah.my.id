import React, { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

const API_BASE = '/api';

const StarRating = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" onClick={() => onChange(n)} className={`text-2xl transition-colors ${n <= value ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}>★</button>
    ))}
  </div>
);

export default function Feedback() {
  const [form, setForm] = useState({ email: '', name: '', message: '', rating: 0 });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.message) { setError('Email dan pesan wajib diisi.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) { setSuccess(data.message); setForm({ email: '', name: '', message: '', rating: 0 }); }
      else setError(data.error || 'Gagal mengirim feedback');
    } catch { setError('Terjadi kesalahan koneksi'); }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-primary-hover)] p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare size={28} />
            <h1 className="text-2xl font-bold">Feedback</h1>
          </div>
          <p className="text-white/80 text-sm">Bantu kami meningkatkan kualitas layanan dengan memberikan masukan Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
              ✅ {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="email@contoh.com"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--app-primary)] bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Nama (opsional)</label>
              <input
                type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nama Anda"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--app-primary)] bg-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Rating</label>
            <StarRating value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">
              Pesan / Masukan <span className="text-red-500">*</span>
            </label>
            <textarea
              required value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Tuliskan saran, kritik, atau masukan Anda di sini..."
              rows={5}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--app-primary)] bg-white text-sm resize-none"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-[var(--app-primary)] text-white font-bold py-3 rounded-xl hover:bg-[var(--app-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={18} />
            {loading ? 'Mengirim...' : 'Kirim Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
