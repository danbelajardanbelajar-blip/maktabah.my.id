# Ringkasan, filter, dan pengelolaan riwayat admin

Semua delapan riwayat di Admin → Aktivitas memakai tabel dan statistik yang sama. Di bawah statistik terdapat lima item teratas untuk pencarian, pertanyaan, IP, serta halaman/sumber. Kategori yang tidak memiliki kolom sumber pada jenis log tersebut menampilkan keadaan kosong, bukan data perkiraan. Pencarian/pertanyaan dikelompokkan menurut teks lengkap yang di-trim dan dilowercase; IP dihitung berdasarkan jumlah catatan, bukan identitas orang. Halaman/sumber mengikuti konteks log: path kunjungan, kitab unduhan, surah, profil perawi/penulis, halaman pembaca, atau sumber halaman yang dipilih pada Tanya AI.

Klik item ringkasan untuk menerapkan filter kelompok persis. Pencarian teks memperlakukan `%`, `_`, dan backslash sebagai karakter literal. Tanggal awal/akhir dihitung dalam WIB. Log yang mendukungnya menyediakan filter jenis aktivitas dan jumlah hasil: nol, positif, atau tidak diketahui. Jumlah hasil pencarian isi/judul baru dicatat setelah pencarian berhasil pada halaman pertama; data lama tanpa jumlah hasil tetap bernilai tidak diketahui.

Pagination, filter, dan ringkasan diproses server pada seluruh tabel. Batas 500 hanya berlaku per halaman/batch pilihan, bukan seluruh riwayat. Statistik tetap mencakup seluruh tabel, sementara jumlah hasil dan ringkasan mengikuti filter aktif. Mengubah halaman/filter membersihkan pilihan baris untuk mencegah pilihan tersembunyi terhapus tanpa sengaja.

## Penghapusan

- Hapus terpilih: hanya ID terpilih dalam jenis log aktif, maksimal 500 ID per permintaan.
- Hapus seluruh hasil filter: tersedia setelah filter diterapkan dan pratinjau selesai. Konfirmasi menyebut jumlah serta jenis log. Server memeriksa filter, jumlah yang dipratinjau, dan ID maksimum pada snapshot. Catatan yang datang sesudah pratinjau tetap dipertahankan; perubahan jumlah pada snapshot mengharuskan admin memuat ulang.
- Penghapusan hanya menghapus baris tabel log tersebut. Isi kitab, dataset perawi/penulis, log jenis lain, dan akun tidak disentuh. Statistik, ringkasan, tabel, serta badge sidebar dimuat ulang setelah berhasil.
- Endpoint baca dan DELETE `/api/admin/logs/:type` tetap memerlukan Bearer admin. Cookie penanda aktivitas admin tidak memberikan hak baca atau hapus. Mutasi ditolak selama import/export/penghapusan/transfer aktif.

## Aktivitas admin

Browser menambahkan token admin hanya pada fetch API dengan origin yang sama; token tidak ditambahkan pada aset atau layanan eksternal dan tidak menimpa Authorization eksplisit. Login juga memasang cookie sesi HttpOnly, SameSite=Lax (Secure pada HTTPS), sehingga tautan unduhan/pembaca dapat dikenali sebagai aktivitas admin. Logout menghapus token server dan cookie.

Server memverifikasi token terhadap `admin_tokens` pada setiap permintaan. Alamat IP, header penanda buatan, maupun token palsu tidak dianggap sebagai admin. Pencarian/pertanyaan, kunjungan, unduhan, Al-Qur'an, perawi, hadis, dan penulis dari admin terautentikasi tidak ditulis ke log aktivitas pengunjung. Setelah logout, aktivitas browser kembali dicatat sebagai pengunjung. Riwayat AI pada sessionStorage browser dapat tetap tampil, tetapi aktivitas admin baru tidak masuk catatan server.

Catatan lama tidak memuat identitas admin yang dapat dipastikan. Sistem tidak menebak berdasarkan IP yang mungkin dipakai bersama. Admin dapat meninjau dan menghapus catatan lama secara eksplisit melalui filter/pilihan.

## Verifikasi

Tes otomatis mencakup agregasi lebih dari 500 baris, delapan jenis log, pertanyaan/halaman, JSON konteks rusak, wildcard literal, batas tanggal WIB, pagination, validasi input, isolasi penghapusan, snapshot, identitas terverifikasi, token palsu, cookie/logout, serta perlindungan origin pada fetch. Uji server lengkap dan browser memakai database sementara: aktivitas pengunjung vs admin, cookie dan logout, pagination, klik ringkasan, hapus kelompok 510 baris, kedatangan catatan baru, batal/hapus pilihan, CSV, delapan layar log, desktop/ponsel, dan tema hijau/krem/gelap. Tidak melakukan penghapusan data produksi.

Deployment memerlukan pull kode dan aset hasil build lokal serta restart backend sesudah memastikan tidak ada operasi transfer aktif. Tidak menjalankan install/build di hosting. Versi lama endpoint log ditolak dengan pesan pembaruan yang jelas agar aset baru tidak salah membaca respons backend lama.
