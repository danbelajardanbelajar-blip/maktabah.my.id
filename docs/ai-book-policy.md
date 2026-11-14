# Pengecualian seluruh kitab pada rujukan AI

Tanya AI mengecualikan seluruh kitab apabila satu atau lebih halaman `pages.nass` memuat salah satu nama berikut: `بن باز`, `عثيمين`, `محمد بن عبد الوهاب`, atau `ابن تيمية`. Daftar berada di `server/ai-book-policy.js`. Pencocokan mengabaikan harakat, tatweel, penanda format tak terlihat, variasi alif, dan variasi spasi/baris pada nama. Teks HTML serta entitas karakter dibaca sebagai teks halaman. Pencocokan berlaku juga saat nama sekadar disebut atau dikritik.

Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanyaan dan tidak masuk cuplikan pencarian. Pemeriksaan berlaku pada database utama dan tambahan. Karena aplikasi memakai ID kitab lintas sumber, ID yang sama dikecualikan secara konservatif jika salah satu sumber memuat nama tersebut. Judul/metadata tanpa kemunculan pada halaman tidak menjadi pemicu tersendiri. Nama yang terpisah melintasi dua halaman tidak dianggap muncul pada satu halaman.

## Jalur yang dilindungi

- Pencarian rujukan awal dan perluasan kata kunci Arab: hanya kitab yang lolos pemeriksaan dikirim sebagai konteks ke provider. Apabila hasil teratas seluruhnya dikecualikan, pencarian diulang dengan ID tersebut dikeluarkan sebelum batas jumlah hasil; maksimal delapan putaran dengan batas waktu pemeriksaan.
- Jawaban katalog pada Tanya AI: metadata kitab yang dikecualikan tidak dipakai sebagai rujukan jawaban.
- Penjelasan dan terjemahan dari pembaca: permintaan ditolak dengan `AI_SOURCE_EXCLUDED` dan HTTP 403 meskipun halaman/teks yang dipilih sendiri tidak memuat nama tersebut.
- Cache jawaban: namespace memakai versi kebijakan baru; setiap penggunaan cache juga memeriksa kembali kelayakan seluruh kitab. Cache lama tidak dapat melewati filter.
- Penyusunan/review jawaban: kelayakan diperiksa ulang sebelum pengiriman jawaban dan penyimpanan cache. Perubahan kitab saat pemeriksaan/generasi membuat permintaan gagal tanpa mengirim rujukan yang sudah tidak layak.

Jika seluruh sumber tersaring, respons menjelaskan belum ditemukannya konteks yang sesuai. Pencarian biasa, katalog publik, dan pembacaan kitab tetap tersedia. Riwayat percakapan/log terdahulu tidak dihapus atau ditulis ulang.

## Pemeriksaan dan invalidasi

Sumber berbasis file dipindai melalui worker dengan koneksi SQLite hanya-baca; tidak menulis indeks atau mengubah database kitab. Pemeriksaan memiliki batas 20 detik per batch dan maksimal dua worker aktif. Timeout, pembatalan, sumber hilang, atau perubahan sumber tidak pernah mengesahkan kitab yang belum selesai diperiksa. Database in-memory pada tes diperiksa melalui koneksi yang sama.

Hasil pemeriksaan disimpan dalam memori per koneksi/sumber dan maksimal 2.048 ID kitab. Perubahan eksternal terdeteksi lewat `data_version`/`schema_version`. Import/penghapusan melalui aplikasi membatalkan cache kebijakan bersama cache pustaka; edit/hapus halaman admin membatalkan cache kebijakan dan jawaban AI. Penulisan log biasa tidak membatalkan cache kelayakan kitab. Jika menambah jalur mutasi isi kitab pada masa mendatang, panggil `invalidateAiBookPolicy(db)` atau `invalidateLibraryCache()` setelah mutasi berhasil.

## Verifikasi dan deployment

Tes meliputi keempat nama dan normalisasinya, pemicu pada halaman lain, katalog, dua database, ID lintas sumber, sumber pembaca, cache lama/baru, perubahan isi selama generasi/review, pemindaian file hanya-baca, perubahan eksternal, pembatalan, serta pencarian alternatif di bawah hasil teratas yang tersaring. Provider pada pengujian adalah tiruan; kutipan tetap berasal dari SQLite fixture.

Perubahan hanya backend dan tes/dokumentasi, sehingga tidak memerlukan perubahan aset frontend atau import ulang dataset. Sesudah pull commit, restart backend hanya setelah memastikan tidak ada import/export/penghapusan/transfer aktif. HEAD server, status layanan, dan fungsi online wajib diperiksa sebelum deployment dinyatakan selesai. Install/build tidak dijalankan di hosting.

`GET /api/ai/status` menyertakan `sourcePolicyVersion: "whole-book-exclusions-v1"` untuk membantu memeriksa versi backend online tanpa memanggil provider AI.
