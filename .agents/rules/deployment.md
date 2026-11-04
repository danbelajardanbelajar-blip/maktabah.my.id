---
name: Deployment
description: Aturan terkait instalasi library dan deployment untuk project golden_mobile_server di shared hosting.
trigger: always_on
---
# Aturan Deployment (Shared Hosting)

Untuk project `golden_mobile_server`:
1. **DILARANG** menyuruh pengguna untuk menjalankan perintah `npm install` di sisi server/hosting (karena ini adalah shared hosting).
2. Segala macam instalasi dependensi (seperti `npm install`) dan proses build (`npm run build`) HANYA boleh dilakukan di komputer LOKAL.
3. Yang di-upload atau di-push ke server hanyalah hasil build tersebut.
