@echo off
setlocal
title Maktabah Lokal - Kutub Hadis
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
node scripts\start_local.js --port=3085 --hadith
if errorlevel 1 (
  echo Gagal membuka layanan Kutub Hadis lokal. Lihat pesan di atas.
  pause
)
