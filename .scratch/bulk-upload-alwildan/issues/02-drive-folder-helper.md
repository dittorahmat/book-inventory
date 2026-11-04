# 02: Shared Helper & Service Ekstraksi Google Drive Folder Publik

**What to build:**
Modul helper dan endpoint backend untuk mendeteksi serta membaca link Google Drive Folder publik (`/folders/...`), mem-parse daftar file spreadsheet di dalamnya, dan menyediakan endpoint proxy server agar aman dari pembatasan CORS browser untuk katalog buku maupun data siswa.

**Blocked by:** 01: Core Parsing Multi-Sheet, Header Fleksibel, & Auto-Tagging Penerbit

**Status:** resolved

- [x] Fungsi helper `isGoogleDriveFolderUrl` dan `parseGoogleDriveFolderHtml` tersedia dan teruji
- [x] Endpoint `POST /api/books/parse-drive-url` mengembalikan list file jika berupa folder, atau hasil parsing jika berupa file spreadsheet
- [x] Endpoint `POST /api/students/parse-drive-url` mengembalikan list file atau hasil parsing murid dari folder/sheets
- [x] Unit regression test untuk deteksi dan parsing Drive URL

