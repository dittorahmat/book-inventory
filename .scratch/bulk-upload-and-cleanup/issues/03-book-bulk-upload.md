# 03: Book Catalog Bulk Upload (Backend API & Frontend Modal)

**What to build:**
Fitur bulk upload untuk katalog buku: endpoint backend `POST /api/books/bulk-import` (batch chunking D1 safe, validasi duplikat, upsert) dan komponen antarmuka `BookBulkUploadModal` di `BooksView` yang mendukung file Excel, CSV, Google Sheets, dan manual paste dengan tabel preview sebelum simpan.

**Blocked by:** 01: Database Reset & Purge Tooling (Lokal & Remote D1)

**Status:** ready-for-agent

- [ ] Endpoint backend `POST /api/books/bulk-import` dengan Zod schema & D1 safe writes
- [ ] Komponen frontend `BookBulkUploadModal` dengan parser file Excel/CSV/link GSheets
- [ ] Integrasi tombol "Bulk Upload" di `BooksView`
- [ ] Regression unit tests di backend dan frontend
