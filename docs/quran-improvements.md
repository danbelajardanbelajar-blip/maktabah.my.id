# Perbaikan pembaca Al-Qur’an — 8 November 2026

- [x] 1. Konsistensi respons surah, basmalah, pemulihan gagal memuat dan penghentian loading tafsir.
- [ ] 2. Navigasi ponsel, panel pilihan, tata letak responsif, bahasa, tema, tipografi dan informasi tafsir.
- [ ] 3. URL ayat, Kembali/Maju, posisi terakhir serta verifikasi gabungan.

## Tahap 1

Build/TypeScript dan tes basmalah lulus. Pengujian interaksi React dengan respons tertunda memastikan surah terpilih tidak lagi ditimpa respons lama. Render menggunakan teks ayat pertama dari API online memastikan basmalah Al-Fatihah hanya muncul sekali. Pengujian ini tidak menggantikan uji sentuhan/visual pada perangkat nyata.
