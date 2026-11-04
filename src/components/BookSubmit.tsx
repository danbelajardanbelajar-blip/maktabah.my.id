import React, { useState, useEffect, useRef } from 'react';
import { Upload, Send, FileText, X } from 'lucide-react';

const API_BASE = '/api';

export default function BookSubmit() {
  const [form, setForm] = useState({ email: '', name: '', book_title: '', book_author: '', category_id: '', notes: '' });
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then(d => setCategories(d.data || []))
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext || '')) {
      setError('Hanya file PDF dan DOCX yang diizinkan'); return;
    }
    if (f.size > 50 * 1024 * 1024) { setError('Ukuran file maksimal 50MB'); return; }
    setFile(f); setError('');
  };

    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.book_title) { setError('Email dan judul kitab wajib diisi.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      let file_data = null;
      let file_name = null;

      if (file) {
        file_data = await toBase64(file);
        file_name = file.name;
      }

      const payload = {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        file_data,
        file_name
      };

      const res = await fetch(`${API_BASE}/book-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setForm({ email: '', name: '', book_title: '', book_author: '', category_id: '', notes: '' });
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      } else setError(data.error || 'Gagal mengirim kitab');
    } catch { setError('Terjadi kesalahan koneksi'); }
    setLoading(false);
  };

  const fileSizeStr = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Upload size={28} />
            <h1 className="text-2xl font-bold">Submit Kitab</h1>
          </div>
          <p className="text-white/80 text-sm">Berkontribusi dengan mengirimkan kitab untuk ditambahkan ke koleksi perpustakaan digital ini</p>
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
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Nama (opsional)</label>
              <input type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nama Anda"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 bg-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">
              Judul Kitab <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={form.book_title}
              onChange={e => setForm(p => ({ ...p, book_title: e.target.value }))}
              placeholder="Judul kitab yang dikirimkan..."
              dir="auto"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 bg-white text-sm"
              style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Nama Pengarang (opsional)</label>
            <input type="text" value={form.book_author}
              onChange={e => setForm(p => ({ ...p, book_author: e.target.value }))}
              placeholder="Nama pengarang..."
              dir="auto"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 bg-white text-sm"
              style={{ fontFamily: 'var(--arabic-font)', textAlign: 'right' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Kategori (opsional)</label>
            <select value={form.category_id}
              onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 bg-white text-sm"
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">
              File Kitab <span className="text-gray-400 text-xs font-normal">(PDF / DOCX, maks. 50MB)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl px-4 py-3">
                <FileText size={20} className="text-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{fileSizeStr(file.size)}</p>
                </div>
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 px-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                <Upload size={32} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500 font-semibold">Klik untuk memilih file</span>
                <span className="text-xs text-gray-400 mt-1">PDF atau DOCX (maks. 50MB)</span>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--app-text)] mb-1.5">Keterangan Tambahan (opsional)</label>
            <textarea value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Informasi sumber, catatan, atau keterangan lainnya..."
              rows={3}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 bg-white text-sm resize-none"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={18} />
            {loading ? 'Mengirim...' : 'Kirim Kitab'}
          </button>
        </form>
      </div>
    </div>
  );
}
