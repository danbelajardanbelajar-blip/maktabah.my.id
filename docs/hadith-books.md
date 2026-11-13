# Kutub Hadis

Halaman publik `/#/kutub-hadis` tersedia pada menu Lainnya. Kelompok bawaan Kutub Tis‘ah. Tersedia Shahihain (2), Sunan Arba‘ah (4), Kutub Sittah (6), Kutub Tis‘ah (9), Kutub ‘Asyrah menurut Ithaf al-Maharah (10), Ithaf beserta pelengkap ad-Daraquthni (11), serta gabungan seluruh sumber (17). Kelompok 10/11 mengikuti karya Ibnu Hajar dan bukan klaim istilah universal atau penambahan bertingkat atas Kutub Tis‘ah.

## Inspeksi koleksi lokal pada 13 November 2026

Pembacaan Jackcess menggunakan readOnly=true pada `D:/MAKTABAH_CAKZEN_2026/Buka Lewat Sini/Files/main.mdb`, `Special.mdb`, `Files/user.mdb`, dan `Syameela/user.mdb`. Sumber asli tidak diedit atau diimpor ulang. Metadata yang diperlukan diekspor ke file inspeksi sementara; hasil JSONL disimpan di direktori Temp, dan log inspeksi berada di dev-data. Keduanya tidak masuk Git.

- `main.mdb/0bok`: 1.375 judul, `0cat`: 32 kategori. Kategori 19 bernama متون الحديث. Contoh ID asli: Muwattha’ 40, Bukhari 41, Muslim 42, Abu Dawud 43, Tirmidzi 44, Nasa’i 45, Ibnu Majah 46, Ahmad 47, Darimi 52, Ibnu Hibban 53, Ibnu Khuzaimah 54. Semua ini ID sumber, bukan ID pada database web.
- `Special.mdb` memiliki tabel Auth, rowa, men/MenDetail, Shrooh, shorts, dan tabel Al-Qur’an; tidak ditemukan tabel tersendiri untuk kelompok Kutub 9/10/11. Tabel magal/premagal di kedua user.mdb kosong.
- Kode Android pada `android-native-bookapp/app/src/main/java` berisi katalog/pembaca umum; pencarian istilah Kutub/Hadis/Tis‘ah/Asyrah tidak menemukan halaman kelompok tersebut. Ini tidak membuktikan seluruh kemampuan executable Windows lama; antarmuka executable tidak diuji secara langsung.
- Dengan demikian, data kitabnya sudah ada dalam sumber, sedangkan kelompok pada halaman web ini merupakan kurasi baru dengan rujukan yang disebutkan di bawah.

## Susunan dan rujukan

Kutub Tis‘ah: Bukhari, Muslim, Abu Dawud, Tirmidzi, Nasa’i al-Mujtaba, Ibnu Majah, Muwattha’ Malik, Musnad Ahmad, Darimi. Sunan al-Kubra an-Nasa’i dan kitab syarah tidak dihitung sebagai al-Mujtaba.

Ithaf al-Maharah: Muwattha’, Musnad asy-Syafi‘i, Musnad Ahmad, Darimi, Sahih Ibnu Khuzaimah, Sahih Ibnu Hibban, al-Muntaqa Ibn al-Jarud, al-Mustadrak al-Hakim, Mustakhraj Abi ‘Awanah, Syarh Ma‘ani al-Atsar. Kelompok 11 menyertakan Sunan ad-Daraquthni.

- Mukadimah Sunan ad-Darimi: https://usul.ai/bn/t/sunan-al-darami/13
- Daftar sumber Ithaf: https://app.alreq.com/ar/AuthoredBooks/AuthoredBook/3908afce-2ffc-441b-3e6b-08d79e7d2715
- Mukadimah Musnad ad-Darimi, penjelasan sepuluh sumber dan tambahan ad-Daraquthni: https://saaid.org/book/21/15211.pdf

## Implementasi dan verifikasi

Manifest `server/data/hadith-books.json` menyimpan judul sumber, daftar judul edisi yang telah ditinjau dari metadata lokal, kelompok, dan rujukan. `GET /api/hadith-books` mencocokkan judul ternormalisasi secara utuh terhadap katalog server saat itu. Tidak memakai nomor MDB sebagai nomor web, pencocokan substring bebas, atau nama murid perawi. ID ganda dengan judul bertentangan dikeluarkan; edisi yang hilang dari katalog langsung tidak ditampilkan. Satu judul sumber tetap satu anggota kelompok meskipun edisinya banyak. Daftar judul yang disetujui perlu ditinjau jika ada edisi baru dengan penamaan baru.

Halaman mendukung pencarian Arab/Latin, filter kelompok dan ketersediaan pada URL, pilih edisi, baca, detail metadata kitab, dan tautan Kamus Perawi/Penulis. Katalog ini bukan penilaian kesahihan semua hadis dalam setiap kitab. Pemilihan kitab menggunakan pembaca yang sudah ada, termasuk terjemahan/penjelasan inline.

Lokal terbaru berjalan terpisah pada port 3083; `Buka Kutub Hadis Lokal.bat` membuka `http://127.0.0.1:3083/#/kutub-hadis`. Launcher memeriksa kemampuan `hadith-books-v1` agar tidak memakai backend lama. Database kitab, perawi, dan penulis tidak dimodifikasi.

Pengujian server mencakup komposisi kelompok, identitas judul, konflik ID, pengecualian kitab syarah/Kubra, perubahan katalog, endpoint offline, dan URL. Build dijalankan lokal; pull VPS dan restart layanan dilakukan setelah pemeriksaan transfer aktif.


## Pencarian isi dalam lingkup Kutub Hadis

Pilihan **Cari dalam → Isi kitab** menelusuri konten halaman dalam kelompok aktif. Pengguna dapat membatasi pada satu judul sumber dan satu edisi. Pilihan **Semua kata** mencari semua kata pada halaman yang sama; **Frasa berurutan** menjaga urutan kata. Input maksimal 300 karakter / 12 kata. Pencarian Arab mengabaikan harakat, tatweel, perbedaan alif/hamzah, dan ya/alif maqshurah. Ini pencarian teks, bukan terjemahan kata kunci.

`GET /api/hadith-books/search?q=...&group=nine&book=bukhari&edition=2130&matching=phrase&page=1` memvalidasi kelompok, sumber, serta edisi berdasarkan katalog nyata. ID kitab lain tidak dapat dimasukkan untuk keluar dari lingkup. Hasil per halaman maksimal 20 halaman kitab, dengan hasMore tanpa menghitung semua temuan. Batas penelusuran 100 halaman hasil; gunakan kata/filter lebih khusus bila lebih banyak. Duplikasi teks lintas edisi dapat muncul karena merupakan halaman sumber berbeda. ID/label jilid dan halaman asli dipertahankan. Tautan baca membuka halaman yang tepat dengan sorotan pencarian; URL menyimpan filter dan pagination sehingga kembali/reload mempertahankan konteks.

### Indeks terpisah dan siklus hidup

Database tambahan lokal belum memiliki FTS, dan FTS lama tidak konsisten menemukan teks Arab berharakat. Karena itu digunakan indeks turunan khusus semua 17 sumber, bukan pemindaian teks seluruh perpustakaan pada tiap pencarian. `dev-data/hadith-search/` berisi SQLite FTS5 contentless untuk teks yang dinormalisasi, tabel pemetaan book/page/source, dan pointer active.json. Teks/cuplikan yang ditampilkan selalu dimuat dari halaman asli melalui identitas kitab/halamannya. Database sumber dibuka hanya-baca, dan indeks tidak masuk Git.

Indeks dibangun dalam worker terpisah saat belum ada atau perlu diperbarui. Build membaca snapshot sumber, menulis generasi baru, melakukan quick_check, lalu mengganti pointer secara atomik. Satu generasi sebelumnya dipertahankan; hanya file indeks turunan yang lebih lama dalam direktori cache tersebut yang dibersihkan. Kesalahan build tidak mengaktifkan file parsial. Generasi aktif dibandingkan dengan sidik metadata sumber/edisi dan lokasi database. Hit yang halaman aslinya hilang/berubah memicu pembaruan. Import/penghapusan/perubahan katalog melalui web menandai indeks dirty melalui invalidateLibraryCache; proses ini juga tetap membersihkan cache AI seperti sebelumnya. Perubahan langsung database dari luar web memerlukan penandaan dirty atau pembuatan ulang indeks, karena tidak melalui callback aplikasi.

Selama persiapan, API mengembalikan 202/preparing dengan progres halaman. UI menunggu dan mengulangi otomatis. Pencarian berjalan pada worker maksimal dua permintaan bersamaan, timeout 15 detik, dan pembatalan saat filter/halaman berubah. Pembaruan database yang sedang aktif memberi 409. Error indeks memberi jeda sebelum dapat dibangun ulang. Metadata dan hasil yang tidak cocok tidak dilebarkan ke seluruh pustaka atau dialihkan ke Tanya AI.

Lokal versi pencarian memakai `Buka Kutub Hadis Lokal.bat` pada port **3085**, dengan pemeriksaan kemampuan hadith-search-v2. Port layanan lama tidak dihentikan. Indeks lokal awal mencakup 757.404 halaman dan berukuran sekitar 223 MiB; jumlah/ukuran server mengikuti koleksi aktualnya. Build kode/dependensi tetap dilakukan lokal; pembuatan indeks data turunan berlangsung pada masing-masing server.
