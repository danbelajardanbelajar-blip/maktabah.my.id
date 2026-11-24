# Pencatatan kunjungan dan aktivitas situs

## Cakupan

- Kunjungan halaman React memakai rute URL, bukan hanya nama tab. Kategori, pagination, profil penulis, filter perawi, pilihan surah/ayat dan tampilan tafsir dibedakan oleh parameter rute yang diizinkan. Parameter asing seperti token tidak ikut disalin.
- Halaman HTML mandiri `/privacy-policy`, `/privacy-policy/`, dan `/privacy-policy.html` memakai tracker yang sama. Halaman tetap dapat dibaca tanpa JavaScript, tetapi pencatatan kunjungannya memerlukan JavaScript.
- Pembaca hanya mencatat `/read/{bookId}/{pageId}` sesudah konten berhasil dimuat. Tautan pembaca yang gagal tidak menghasilkan kunjungan pembaca palsu. Pergantian halaman kitab dan pembukaan profil perawi dicatat.
- Log metadata kitab historis `/book/{id} - {judul}` tetap dipertahankan, termasuk untuk statistik kitab populer. Ini menunjukkan permintaan metadata, bukan jumlah pembaca unik; kunjungan pembaca kini memiliki rute tersendiri.
- Admin terautentikasi tetap dikecualikan melalui identitas server (cookie/token). Rute admin juga tidak menghasilkan kunjungan publik sebelum login.

## Klik QRIS

`qris_view` dan `qris_download` masuk ke `site_action_logs`, terpisah dari `visit_logs`. Menu **Admin → Aktivitas → Log Aktivitas Situs** menyediakan pencarian, filter jenis aktivitas, tanggal WIB, ringkasan, dan pengelolaan catatan. Aktivitas situs ikut dihitung dalam grafik log harian, tetapi tidak menambah angka kunjungan halaman.

Klik unduh menyatakan pengguna menekan tautan unduh, bukan jaminan berkas selesai tersimpan. Kedua jenis klik bukan bukti donasi berhasil. Akses langsung ke gambar sebagai aset di luar halaman aplikasi tidak menghasilkan klik antarmuka.

## Pengiriman dan deduplikasi

- Satu ID acak dibuat per kejadian. Percobaan ulang menggunakan ID yang sama; indeks unik server mencegah duplikasi apabila respons hilang setelah INSERT berhasil.
- Antrean maksimal 100 kejadian disimpan di `sessionStorage`, dengan cadangan di memori bila penyimpanan tidak tersedia. Kejadian kedaluwarsa setelah 24 jam; ketika antrean penuh, yang tertua dikeluarkan.
- Pengiriman memakai `fetch` dengan `keepalive`, timeout 8 detik, dan jeda percobaan ulang bertahap hingga 60 detik. Koneksi pulih, halaman terlihat kembali, dan pemulihan halaman dari cache browser memicu pemeriksaan antrean.
- Status sukses harus mengandung JSON `success: true`. Kesalahan permanen 400/401/403/404/413/422 dikeluarkan dari antrean. Kegagalan jaringan/server sementara dicoba ulang.
- Kunjungan berulang akibat beberapa event navigasi untuk URL yang sama dicegah; kembali dari halaman lain dan reload tetap menjadi kejadian baru.
- Tidak ada jaminan pencatatan 100% ketika JavaScript/permintaan analitik diblokir, sesi ditutup sebelum terkirim, atau antrean kedaluwarsa. Waktu `created_at` adalah waktu penerimaan server, termasuk kejadian yang dikirim ulang setelah offline.

## Penerapan

Build dilakukan di lokal. Pull commit yang sama di server, lalu restart backend setelah memastikan tidak ada transfer/import/export/penghapusan aktif. Inisialisasi menambah kolom `visit_logs.event_id`, indeks unik parsial, dan tabel `site_action_logs` tanpa menghapus log lama. Kunjungan yang dahulu tidak dicatat tidak direkonstruksi.

Verifikasi HEAD server, status layanan, HTML/aset build, endpoint log dengan deduplikasi, halaman privasi, dan akses admin sebelum menyatakan deployment selesai. Jangan menjalankan build/install di server.
