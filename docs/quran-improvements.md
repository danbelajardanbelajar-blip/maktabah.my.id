# Perbaikan pembaca Al-Qur’an — 8 November 2026

- [x] 1. Konsistensi respons surah, basmalah, pemulihan gagal memuat dan penghentian loading tafsir.
- [x] 2. Navigasi ponsel, panel pilihan, tata letak responsif, bahasa, tema, tipografi dan informasi tafsir.
- [x] 3. URL ayat, Kembali/Maju, posisi terakhir serta verifikasi gabungan.

## Tahap 1

Build/TypeScript dan tes basmalah lulus. Pengujian interaksi React dengan respons tertunda memastikan surah terpilih tidak lagi ditimpa respons lama. Render menggunakan teks ayat pertama dari API online memastikan basmalah Al-Fatihah hanya muncul sekali. Pengujian ini tidak menggantikan uji sentuhan/visual pada perangkat nyata.

## Tahap 2

Pembaca satu kolom untuk ponsel/tablet, tiga kolom mulai 1280 px. Satu panel pilihan dengan backdrop, Escape, fokus terkurung dan penguncian scroll. Kontrol berlabel, tab Ayat/Tafsir dengan navigasi keyboard, font 22–44 px, mode Fokus layar penuh, warna tema dan safe-area navigasi bawah. Pesan tafsir tidak mengungkap nama file; sumber/jilid/halaman ditampilkan bila tersedia. Metadata nama Latin 114 surah disimpan lokal dari https://api.quran.com/api/v4/chapters?language=id; teks Arab/ayat tetap berasal dari database aplikasi.

Build/TypeScript lulus. Chrome headless memakai API tiruan berdasarkan respons online untuk menguji viewport 320×640, 360×800, 390×844, 768×1024, 1440×1000 dan 844×390, termasuk tema gelap pada 390 dan 1440 px. Pengujian mencakup pencarian Latin, pemilihan ayat 255, pesan kosong tafsir, panel tunggal, Escape, scroll lock, target sentuh 44 px, tidak ada overflow horizontal atau kontrol tertutup navigasi bawah. Screenshot ditinjau untuk ponsel, lanskap dan desktop. Ini emulasi browser desktop, bukan pengujian perangkat fisik atau keyboard Android/iOS.

## Tahap 3 dan verifikasi gabungan

URL `#/quran?surah=2&ayat=255` menunjuk ayat tertentu; `view=tafsir&book=77` menyimpan tab dan sumber yang dipilih. URL eksplisit mengalahkan posisi tersimpan. Tanpa parameter, pembaca melanjutkan posisi terakhir pada browser ini. Font tersimpan 22–44 px; nilai URL/storage divalidasi, ayat yang melewati panjang surah dikembalikan ke rentang yang tersedia. Setiap perpindahan mendukung Kembali/Maju; panel pilihan memakai entri riwayat tersendiri sehingga Kembali menutup panel tanpa mengganti ayat.

Permintaan ayat dan daftar tafsir berjalan terpisah. Permintaan yang ditinggalkan dibatalkan, respons lama diabaikan dan batas waktu 20 detik memberi jalur retry. Keadaan gagal, kosong dan belum ada pemetaan ayat dibedakan; spinner berhenti ketika ayat tidak memiliki pemetaan. Data tafsir di VPS tidak ditambah atau diganti oleh pekerjaan tampilan ini.

Pengujian browser lanjutan lulus untuk tautan langsung, reload, Kembali/Maju, keluar-masuk menu, pemulihan ukuran huruf/tab/sumber, panel melalui tombol Kembali, URL ayat tidak valid, retry daftar surah/ayat/teks tafsir, pergantian surah cepat dan pemetaan tafsir lambat. Cabang tafsir tersedia memakai data uji lokal; pemeriksaan online tetap menggunakan data VPS yang tersedia. Pemeriksaan sampel teks utama pada tema terang, sepia, hijau dan gelap menghasilkan rasio kontras ≥4,5:1; navigasi tab keyboard serta penahanan fokus panel lulus. Ini pemeriksaan terarah, bukan sertifikasi WCAG menyeluruh.

Seluruh 64 tes server/logika lulus dan build produksi berhasil. Browser juga memeriksa font maksimum 44 px, viewport pendek 390×420, keluar mode Fokus melalui Escape, dan penutupan panel melalui backdrop. Pengujian memakai browser headless; perangkat fisik Android/iOS belum diuji.
