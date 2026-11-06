# 03: Batch Runner Pacing & Resilient UI Reporting

**What to build:**
Tambahkan jeda otomatis (pacing interval ~800ms) pada `DriveFolderBatchRunner` dan `BookBulkUploadModal` saat memproses file antrean Google Drive untuk mencegah throttling 503 dari Google. Sediakan tampilan status visual yang jelas untuk file yang berstatus warning (misalnya ringkasan paket dilewati) atau error, serta tombol retry khusus per file. Pastikan chunk import buku bebas tabrakan ISBN ganda.

**Blocked by:** 01-anti-collision-book-identifier, 02-resilient-drive-fetcher

**Status:** ready-for-agent

- [ ] Pacing interval terpasang saat batch loop memproses file Google Drive berurutan.
- [ ] UI menampilkan badge dan status yang membedakan file sukses, file dilewati (warning), dan file error.
- [ ] Pengiriman batch ke `/api/books/bulk-import` memvalidasi keunikan ISBN dalam satu chunk sehingga tidak memicu error D1 unique constraint.
- [ ] Seluruh unit test dan e2e runner tetap hijau.
