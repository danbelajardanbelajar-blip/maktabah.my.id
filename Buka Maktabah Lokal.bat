@echo off
setlocal
title Maktabah Lokal - Export dari D:\db
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js tidak ditemukan. Pasang Node.js 24 terlebih dahulu.
  pause
  exit /b 1
)
if not exist "node_modules\dotenv\package.json" (
  echo Dependensi belum tersedia. Jalankan npm ci di folder proyek ini.
  pause
  exit /b 1
)
node scripts\start_local.js
if errorlevel 1 (
  echo.
  echo Web lokal gagal dijalankan. Lihat pesan di atas.
  pause
)
