import {recordSiteAction} from '../lib/visit-tracker.js';
import { HeartHandshake, Server, Library, Wrench, Download } from 'lucide-react';

const purposes = [
  { icon: Server, title: 'Operasional server', text: 'Membantu biaya server dan penyimpanan agar koleksi kitab tetap dapat diakses.' },
  { icon: Library, title: 'Perawatan koleksi', text: 'Mendukung penataan dan penambahan koleksi untuk memudahkan belajar.' },
  { icon: Wrench, title: 'Pengembangan aplikasi', text: 'Membantu perbaikan fitur, kenyamanan membaca, dan pemeliharaan Maktabah.' },
];

const qrisUrl = `${import.meta.env.BASE_URL}donations/qris-maktabah.jpg`;

export default function Donation() {
  return (
    <section aria-labelledby="donation-heading" className="max-w-4xl mx-auto my-4 text-[var(--app-text)]">
      <div className="bg-[var(--reader-bg)] border border-black/5 rounded-2xl shadow-sm overflow-hidden">
        <header className="p-6 md:p-10 text-center border-b border-black/5">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--app-primary)]/10 flex items-center justify-center text-[var(--app-primary)]">
            <HeartHandshake size={32} aria-hidden="true" />
          </div>
          <h1 id="donation-heading" className="text-2xl md:text-3xl font-bold mb-3">Dukung Maktabah</h1>
          <p className="max-w-2xl mx-auto leading-relaxed opacity-80">Bantu merawat perpustakaan digital ini agar khazanah kitab semakin mudah diakses dan dipelajari. Dukungan Anda berarti bagi keberlanjutan Maktabah.</p>
        </header>
        <div className="p-6 md:p-10 space-y-8">
          <section aria-labelledby="donation-purpose">
            <h2 id="donation-purpose" className="text-lg font-bold mb-4">Untuk apa dukungan Anda?</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {purposes.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-black/10 p-5">
                  <Icon size={24} className="text-[var(--app-primary)] mb-3" aria-hidden="true" />
                  <h3 className="font-bold mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed opacity-80">{text}</p>
                </div>
              ))}
            </div>
          </section>
          <section aria-labelledby="donation-method" className="rounded-xl bg-[var(--app-primary)]/5 border border-[var(--app-primary)]/15 p-5 md:p-6">
            <h2 id="donation-method" className="text-lg font-bold mb-5">Donasi melalui QRIS</h2>
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <a href={qrisUrl} onClick={() => recordSiteAction('qris_view')} target="_blank" rel="noopener noreferrer" aria-label="Buka gambar QRIS Maktabah ukuran penuh" className="block w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-black/10 focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]">
                <img src={qrisUrl} alt="QRIS donasi Maktabah, penerima ZAINUL HAKIM, BUKU" width={1129} height={1600} className="w-full h-auto" />
              </a>
              <div className="space-y-5 min-w-0">
                <div>
                  <p className="text-sm opacity-75 mb-1">Nama penerima</p>
                  <p className="font-bold">ZAINUL HAKIM, BUKU</p>
                </div>
                <ol className="list-decimal pl-5 space-y-3 text-sm leading-relaxed">
                  <li>Buka aplikasi bank atau dompet digital yang mendukung QRIS.</li>
                  <li>Pindai kode QR di samping, atau unduh gambar lalu pilih dari galeri aplikasi pembayaran Anda.</li>
                  <li>Masukkan nominal donasi sesuai keinginan.</li>
                  <li>Pastikan nama penerima sesuai sebelum menyelesaikan pembayaran.</li>
                </ol>
                <a href={qrisUrl} onClick={() => recordSiteAction('qris_download')} download="QRIS-Maktabah.jpg" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] text-white font-semibold px-5 py-3 text-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-primary)]">
                  <Download size={18} aria-hidden="true" /> Unduh QRIS
                </a>
                <p className="text-sm leading-relaxed opacity-75">Ketuk gambar untuk melihat QRIS ukuran penuh.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-center leading-relaxed opacity-75">Terima kasih atas doa dan dukungan Anda. Donasi bersifat sukarela; Anda tetap dapat membaca dan menggunakan Maktabah seperti biasa.</p>
        </div>
      </div>
    </section>
  );
}
