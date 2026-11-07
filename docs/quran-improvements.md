# Perbaikan pembaca Al-Qur’an — 8 November 2026

- [x] 1. Konsistensi respons surah, basmalah, pemulihan gagal memuat dan penghentian loading tafsir.
- [x] 2. Navigasi ponsel, panel pilihan, tata letak responsif, bahasa, tema, tipografi dan informasi tafsir.
- [ ] 3. URL ayat, Kembali/Maju, posisi terakhir serta verifikasi gabungan.

## Tahap 1

Build/TypeScript dan tes basmalah lulus. Pengujian interaksi React dengan respons tertunda memastikan surah terpilih tidak lagi ditimpa respons lama. Render menggunakan teks ayat pertama dari API online memastikan basmalah Al-Fatihah hanya muncul sekali. Pengujian ini tidak menggantikan uji sentuhan/visual pada perangkat nyata.

## Tahap 2

Pembaca satu kolom untuk ponsel/tablet, tiga kolom mulai 1280 px. Satu panel pilihan dengan backdrop, Escape, fokus terkurung dan penguncian scroll. Kontrol berlabel, tab Ayat/Tafsir dengan navigasi keyboard, font 22–44 px, mode Fokus layar penuh, warna tema dan safe-area navigasi bawah. Pesan tafsir tidak mengungkap nama file; sumber/jilid/halaman ditampilkan bila tersedia. Metadata nama Latin 114 surah disimpan lokal dari https://api.quran.com/api/v4/chapters?language=id; teks Arab/ayat tetap berasal dari database aplikasi.

Build/TypeScript lulus. Chrome headless memakai API tiruan berdasarkan respons online untuk menguji viewport 320×640, 360×800, 390×844, 768×1024, 1440×1000 dan 844×390, termasuk tema gelap pada 390 dan 1440 px. Pengujian mencakup pencarian Latin, pemilihan ayat 255, pesan kosong tafsir, panel tunggal, Escape, scroll lock, target sentuh 44 px, tidak ada overflow horizontal atau kontrol tertutup navigasi bawah. Screenshot ditinjau untuk ponsel, lanskap dan desktop. Ini emulasi browser desktop, bukan pengujian perangkat fisik atau keyboard Android/iOS.
