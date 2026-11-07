import React from 'react';

const Privacy: React.FC = () => {
  const LAST_UPDATED = '7 November 2026';
  const SITE_URL     = 'https://maktab.my.id';
  const CONTACT      = '6285743399595';

  return (
    <div className="w-full bg-white p-6 md:p-10 rounded-2xl shadow-md text-slate-700 leading-relaxed my-4">
      <div className="mb-8 border-b border-[#d7ccc8] pb-6">
        <h1 className="text-3xl font-bold text-[#5d4037] mb-2">Kebijakan Privasi</h1>
        <p className="text-sm font-semibold text-[#795548]">al Maktabah as Sunniyyah</p>
        <p className="text-sm text-gray-500 mt-2">Terakhir diperbarui: <span className="font-bold text-[#5d4037]">{LAST_UPDATED}</span></p>
        <p className="mt-4 text-base">
          Kebijakan Privasi ini menjelaskan bagaimana al Maktabah as Sunniyyah (<a href={SITE_URL} className="text-amber-700 hover:underline font-medium">{SITE_URL}</a>) mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda ketika menggunakan layanan kami.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold text-[#5d4037] mb-3">1. Informasi yang Kami Kumpulkan</h2>
          <p className="mb-2"><strong>Melalui Autentikasi (Jika Tersedia)</strong></p>
          <p className="mb-4">Saat Anda masuk menggunakan akun Google, kami menerima informasi dasar seperti Nama Lengkap, Alamat Email, Foto Profil, dan ID Google.</p>

          <p className="mb-2"><strong>Riwayat & Preferensi Pencarian</strong></p>
          <p className="mb-4">Sistem mencatat pencarian serta pertanyaan dan jawaban Tanya AI. Log layanan juga dapat memuat alamat IP dan informasi peramban untuk operasional, statistik, dan perbaikan layanan.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#5d4037] mb-3">2. Cara Kami Menggunakan Informasi</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Menyediakan layanan membaca dan mencari kitab yang optimal.</li>
            <li>Menyimpan preferensi pembacaan terakhir Anda (jika didukung).</li>
            <li>Menentukan hak akses Anda (pengguna biasa atau administrator).</li>
            <li>Kami <strong>tidak menggunakan</strong> data Anda untuk iklan, analitik pihak ketiga, atau tujuan komersial lainnya.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#5d4037] mb-3">3. Berbagi Data dengan Pihak Ketiga</h2>
          <p className="mb-2">Kami <strong>tidak menjual, menyewakan, atau membagikan</strong> data pribadi Anda kepada pihak ketiga, kecuali:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Google LLC — sebagai penyedia layanan autentikasi (jika digunakan) dan model Gemini untuk Tanya AI. Saat Tanya AI digunakan, pertanyaan dan kutipan kitab yang relevan dikirim ke Gemini untuk menyusun jawaban.</li>
            <li>Penyedia hosting server — hanya memiliki akses teknis ke infrastruktur, bukan data pengguna secara individual.</li>
            <li>Kewajiban hukum — apabila diwajibkan oleh peraturan perundang-undangan yang berlaku.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#5d4037] mb-3">4. Keamanan Data</h2>
          <p className="mb-4">Seluruh komunikasi antara browser dan server dienkripsi menggunakan TLS/SSL (HTTPS). Semua kueri database ke sistem SQLite kami dilakukan secara aman untuk mencegah injeksi berbahaya.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#5d4037] mb-3">5. Hubungi Kami</h2>
          <p className="mb-4">Jika Anda memiliki pertanyaan, permintaan, atau kekhawatiran mengenai kebijakan privasi ini, silakan hubungi kami melalui no WA:</p>
          <a href={`https://wa.me/${CONTACT}`} target="_blank" rel="noreferrer" className="font-bold text-[#5d4037] hover:text-amber-700 bg-[#f4ebd0] px-4 py-2 rounded-lg inline-block">wa.me/{CONTACT}</a>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
