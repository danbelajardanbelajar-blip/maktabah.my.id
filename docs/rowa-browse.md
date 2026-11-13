# Kamus Perawi: linimasa dan abjad

Kamus Perawi (`/#/perawi`) menggunakan gaya Penulis & Karya: hero, ringkasan koleksi, filter abad Hijriah, Linimasa dan Kartu.

- Linimasa satu jalur horizontal pada desktop dan ponsel, berisi penanda tahun dan jumlah perawi. Klik tahun untuk melihat nama. Muat kiri/kanan menambahkan 10 penanda; awal dibuka di tengah rentang, atau di sekitar tahun pada URL.
- Kartu menyediakan 28 huruf Arab, Semua dan Lainnya. Huruf mengikuti nama lengkap yang ditampilkan (A_esm, lalu Name, lalu IsoName); harakat/tatweel diabaikan dan variasi alif digabung. Awalan ال / ابن tetap dihitung. Angka per huruf berasal dari seluruh hasil pencarian/abad sebelum paginasi.
- Pencarian nama membuka kartu, urutan nama. Kartu juga dapat diurutkan berdasarkan rujukan waktu. Filter tahun tetap dipertahankan ketika berganti tampilan; tersedia tombol hapus filter. Perubahan filter mengulang halaman pertama.
- Tahun merupakan rujukan wafat, bukan masa hidup. Sebelum/setelah/perkiraan tetap diberi label dan teks asli pada kartu. Alternatif tahun, angka gabungan ambigu, masa pemerintahan, dan tanggal kosong tidak ditebak. Semuanya tersedia di kelompok Tahun belum terpetakan. Abad mengikuti tahun rujukan untuk tanggal berkualifikasi.
- Maksimal 24 nama per halaman, termasuk kelompok tanggal belum terpetakan. API linimasa hanya mengirim tahun/jumlah, bukan ribuan profil atau teks biografi.
- Klik nama atau Lihat Profil membuka bithaqah sumber yang sama dengan pembaca kitab. Modal menggunakan ID kanonis langsung, guru/murid tetap dapat dibuka di modal, dan menutup modal mempertahankan filter, halaman, URL dan fokus.
- Daftar kitab tetap memakai simbol WHO sumber. Hubungan guru/murid tidak digunakan untuk menyimpulkan kitab periwayatan.

## Lokal

Jalankan `Buka Kamus Perawi Lokal.bat`, atau `node scripts/start_local.js --port=3089 --rowa`. Alamat: http://127.0.0.1:3089/#/perawi. Port ini memisahkan proses backend lama yang masih berjalan; port lama harus dihentikan oleh pengelolanya sebelum dipakai kembali. DB utama/tambahan/tafsir tetap hanya-baca; fitur ini membaca paket perawi aktif yang sudah terpasang, tanpa import ulang atau menyalin DB ke Git.

## Implementasi dan verifikasi

`server/rowa-browse.js`: API `/api/rowa/browse`, cache metadata ringan per DB aktif (cek data_version/TTL), normalisasi nama, pemetaan tanggal konservatif, facet global, paginasi dan penanda waktu. API pencarian lama tetap tersedia.

`src/components/RowaDictionary.tsx`, `RowaTimeline.tsx`: URL state q/century/initial/year/view/sort/page, pembatalan request usang, filter responsif, pemuatan rentang, dan profil melalui RowaCardsProvider.

Pemeriksaan sebelum push: `node --test server/*.test.js` (155 lulus), `npm run build`, pemeriksaan sintaks serta diff. QA browser Edge: tahun tanpa nama sebelum diklik, muat kedua arah, deep link tahun/reload, 24 kartu pada kelompok tanggal kosong, abjad global/reset halaman, pencarian dan bithaqah/kembali, filter abad, ponsel 390px tanpa overflow halaman. Regresi kartu perawi dalam pembaca/hasil Kutub Hadis dan abjad penulis juga lulus. Tidak ada pageerror browser.

## Verifikasi deployment · 2026-11-13 08:48 WIB

Commit fitur `2489659` sudah di-push ke origin/main dan di-pull fast-forward pada `/home/ubuntu/maktabah-baru`. Sebelum restart, pemeriksaan job transfer/penghapusan dan compact import menyatakan tidak ada operasi aktif. `maktabah.service` aktif setelah restart; tidak ada build/install di VPS.

API server: 8.858 perawi, 2.248 rujukan waktu yang dapat dipetakan konservatif, 8.854 biografi, 267 kelompok waktu, 29 kategori huruf (28 Arab + Lainnya). Huruf م berisi 1.296 perawi. Bukhari ID 5739 tetap WHO ت س dan biografi 40.413 karakter; daftar kitab tidak memuat Muwaththa’.

QA browser pada https://maktab.my.id lulus: penanda tahun tanpa daftar nama sebelum diklik, muat kiri/kanan, deep link/reload tahun, kelompok tanpa tanggal dengan paginasi, abjad global/reset halaman, pencarian dan modal/kembali, filter abad, serta ponsel tanpa overflow. Tidak ditemukan pageerror. Build yang dilayani memakai `index.dev-CCoZynYU.js` dan `index-CNI-N0GB.css`.

Catatan whitespace: pemeriksaan staged awal menandai satu baris kosong tambahan pada akhir launcher BAT. Baris tersebut dihapus pada catatan deployment ini; tidak mengubah perilaku launcher. Pemeriksaan diff akhir diulang sebelum push.
