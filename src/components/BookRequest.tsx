import React, { useState, useEffect } from 'react';
import { BookPlus, Send } from 'lucide-react';

const API_BASE = '/api';

export default function BookRequest() {
  const [form, setForm] = useState({ email: '', name: '', book_title: '', book_author: '', category_id: '', notes: '' });
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/categories/list`)
      .then(r => r.json())
      .then(d => setCategories(d.data || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.book_title) { setError('Email dan judul kitab wajib diisi.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/book-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, category_id: form.category_id ? parseInt(form.category_id) : null })
      });
      const data = await res.json();
      if (res.ok) { setSuccess(data.message); setForm({ email: '', name: '', book_title: '', book_author: '', category_id: '', notes: '' }); }
      else setError(data.error || 'Gagal mengirim permintaan');
    } catch { setError('Terjadi kesalahan koneksi'); }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <BookPlus size={28} />
            <h1 className="text-2xl font-bold">Request Kitab</h1>
          </div>
          <p className="text-white/80 text-sm">Tidak menemukan kitab yang Anda cari? Ajukan permintaan dan kami akan berusaha menghadirkannya</p>
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
              <input type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="email@contoh.com"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Nama (opsional)</label>
              <input type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nama Anda"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 bg-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">
              Judul Kitab <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={form.book_title}
              onChange={e => setForm(p => ({ ...p, book_title: e.target.value }))}
              placeholder="Judul kitab yang diminta..."
              dir="auto"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 bg-white text-sm"
              style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Nama Pengarang (opsional)</label>
            <input type="text" value={form.book_author}
              onChange={e => setForm(p => ({ ...p, book_author: e.target.value }))}
              placeholder="Nama pengarang..."
              dir="auto"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 bg-white text-sm"
              style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Kategori (opsional)</label>
            <select value={form.category_id}
              onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 bg-white text-sm"
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Keterangan Tambahan (opsional)</label>
            <textarea value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Informasi tambahan seperti penerbit, tahun terbit, nomor ISBN, dll..."
              rows={4}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 bg-white text-sm resize-none"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={18} />
            {loading ? 'Mengirim...' : 'Kirim Permintaan'}
          </button>
        </form>
      </div>
    </div>
  );
}
