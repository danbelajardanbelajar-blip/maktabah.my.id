@echo off
setlocal
title Maktabah Lokal - Penulis dan Karya
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 tidak ditemukan.
  pause
  exit /b 1
)
if not exist "node_modules\dotenv\package.json" (
  echo Dependensi lokal belum tersedia.
  pause
  exit /b 1
)
node scripts\start_local.js --port=3081 --authors
if errorlevel 1 (
  echo Gagal membuka layanan penulis lokal. Lihat pesan di atas.
  pause
)
