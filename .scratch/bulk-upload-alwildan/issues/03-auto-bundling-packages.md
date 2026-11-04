# 03: Auto-Bundling Paket Buku (BOM) & Backend Bulk Import Enhancement

**What to build:**
Pengayaan pada backend seam `importBookCatalog` dan endpoint `POST /api/books/bulk-import` agar mendukung flag `autoCreatePackages`. Ketika aktif, sistem otomatis membentuk entitas `book_packages` beserta baris relasi `book_package_items` (BOM) per tingkatan kelas & kurikulum secara idempoten dan aman D1 batching.

**Blocked by:** 01: Core Parsing Multi-Sheet, Header Fleksibel, & Auto-Tagging Penerbit

**Status:** resolved

- [x] Parameter `autoCreatePackages` dan `academicYear` diterima pada schema endpoint bulk import
- [x] Entitas `book_packages` dan `book_package_items` terbentuk otomatis sesuai grup kelas & kurikulum
- [x] Total harga paket tersinkronisasi dengan SUM komponen buku
- [x] Unit regression test di `books-bulk.test.ts` memvalidasi pembentukan paket otomatis

