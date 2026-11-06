# 02: Frontend Chunking Safety & Detailed Error Reporting

**What to build:**
Perbaiki `submitBooksInChunks` di frontend agar menjamin bahwa setiap chunk yang dikirim ke `/api/books/bulk-import` bebas dari tabrakan ISBN ganda, serta menangani kegagalan request dengan mengekstrak pesan error terperinci dari backend (bukan pesan generik) agar pengguna dapat melihat penyebab masalah jika terjadi error.

**Blocked by:** 01-payload-upsert-deduplication

**Status:** ready-for-agent

- [ ] Deduplikasi chunk di frontend menjamin keunikan ISBN sebelum dikirim ke endpoint.
- [ ] Modal menampilkan pesan error detail yang dikembalikan server jika terjadi kegagalan.
- [ ] Pengujian unit test di `BookBulkUploadModal.test.tsx` lulus 100%.
