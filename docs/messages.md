# Pesan pengunjung ↔ admin

Tombol pesan mengambang (`src/components/MessageWidget.tsx`) dan kotak masuk admin (`AdminMessages.tsx`, `AdminInboxMini.tsx`) memakai API di `server/messages.js`.

## Link dapat diklik

Teks pesan tetap disimpan dan ditampilkan sebagai teks biasa, bukan HTML. `src/lib/linkify.ts` hanya mengubah alamat `http://`, `https://`, dan `www.` menjadi elemen `<a>` dengan `target="_blank" rel="noopener noreferrer nofollow ugc"`.

- Tanda baca di akhir kalimat tidak ikut menjadi bagian link, termasuk tanda baca Arab (، ؛ ؟).
- Kurung tutup yang memang bagian alamat tetap dipertahankan, misalnya `.../Foo_(bar)`.
- `javascript:`, `data:`, alamat yang memuat user:password, dan teks yang menempel di depan alamat tidak dijadikan link.

## Lampiran file dan gambar

- Pengunjung bisa melampirkan satu file per pesan melalui tombol 🖼️ (gambar) atau 📎 (file), dengan **Ctrl+V** (gambar dari clipboard), atau dengan menyeret file ke formulir. Jika clipboard juga berisi teks, yang ditempel adalah teksnya.
- **Izin per percakapan:** saat admin membuka satu percakapan, di atas kotak balasan (halaman admin maupun tombol pesan mengambang) ada centang *Izinkan pengunjung ini: kirim file / kirim gambar*.
  - Izin hanya berlaku untuk pengunjung pada percakapan itu, bukan untuk semua pengunjung.
  - Percakapan baru dimulai **tanpa izin**, jadi pengunjung baru bisa melampirkan file setelah admin mengizinkannya pada percakapannya.
  - Izin disimpan di kolom `allow_files` dan `allow_images` pada tabel `visitor_message_threads`.
  - Perubahan langsung sampai ke panel pengunjung tersebut (event SSE `settings`) dan ke tab admin lain (event `permissions`).
  - Balasan admin selalu boleh membawa lampiran.
- **Format:**
  - Gambar: JPG, PNG, GIF, WEBP, maksimal 8 MB.
  - File: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, ZIP, maksimal 10 MB.
  - Jenis file ditentukan dari isi byte file (`server/message-attachments.js`), bukan dari nama atau MIME kiriman peramban. SVG/HTML/exe ditolak, dan file `.png` yang isinya HTML juga ditolak.
- **Batas laju:** 10 lampiran per jam per peramban dan 20 per jam per IP, di samping batas pesan yang sudah ada.
- **Penyimpanan:**
  - File disimpan di `uploads/messages/` dengan nama UUID acak. Folder ini diabaikan Git, jadi ikut dicadangkan bersama folder `uploads/` server.
  - Metadata disimpan di kolom `attachment_*` pada tabel `visitor_messages`. Kolom ini ditambahkan otomatis ke database lama tanpa mengubah pesan yang sudah ada.
  - Menghapus percakapan juga menghapus file-filenya.
- **Akses:** `GET /api/messages/attachments/:id` hanya untuk peramban pemilik percakapan atau admin. Pihak lain menerima 404.
  - Gambar ditampilkan inline. File lain selalu dikirim sebagai unduhan (`?download=1` memaksa unduhan).
  - Header respons: `X-Content-Type-Options: nosniff`, CSP `sandbox`, `Cross-Origin-Resource-Policy: same-origin`.
  - Admin memuat lampiran dengan token Bearer (sebagai blob), karena sesi admin belum tentu memiliki cookie admin.

## Tanda terkirim dan dibaca

Di bawah setiap pesan milik sendiri ada tanda di samping jam:
- **✓ (Terkirim):** pesan sudah tersimpan di server.
- **✓✓ biru muda (Dibaca):** pihak lain sudah membaca pesan itu.

**Kapan pesan dianggap dibaca:**
- Pesan pengunjung dianggap dibaca saat admin membuka percakapan atau membalasnya.
- Balasan admin dianggap dibaca saat pengunjung membuka panel pesan saat ada balasan baru.

**Penyimpanan:** `visitor_message_threads.admin_read_id` dan `visitor_read_id` menyimpan id pesan tertinggi yang sudah dilihat masing-masing pihak. Nilainya hanya bertambah.

**Database lama:** kolom ini ditambahkan otomatis dan diisi dari penghitung belum-dibaca, jadi pesan yang belum dibaca tetap tampil ✓.

**Pembaruan langsung lewat event SSE `seen`:**
- Ke pengunjung: `{readUpTo}`.
- Ke admin: `{threadId, visitor_read_id}`.

**Koneksi live admin:** stream admin (`/api/admin/messages/stream`) dibuka dengan `fetch` + header `Authorization: Bearer` (`src/lib/auth-event-source.ts`), bukan `EventSource`, sehingga tidak bergantung pada cookie `maktabah_admin_session`. Tanpa cookie itu, inbox admin sebelumnya jatuh ke polling 30 detik dan tanda ✓✓ terlambat. Polling cadangan tetap ada dan sekarang juga memperbarui tanda di percakapan yang terbuka.

**Data yang dikembalikan API:**
- `GET /api/messages` mengembalikan `readUpTo` (sampai id berapa admin sudah membaca).
- Data percakapan admin memuat `admin_read_id` dan `visitor_read_id`.

## API admin

- `PUT /api/admin/messages/:id/permissions` dengan body `{allowFiles:boolean, allowImages:boolean}` → `{success, allow_files, allow_images}`
- `GET /api/messages` mengembalikan `settings` milik percakapan peramban tersebut: `{allowFiles, allowImages, maxImageBytes, maxFileBytes}`.
