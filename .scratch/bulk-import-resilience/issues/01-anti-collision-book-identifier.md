# 01: Anti-Collision Fallback Book Code & Identifier Normalization

**What to build:**
Perbaiki generator identifier buku internal (`slugifyBookCode` dan `resolveBookIsbn`) agar menghasilkan kode unik deterministik bebas tabrakan (anti-collision) untuk judul-judul panjang yang hanya berbeda di kata terakhir (seperti Coursebook vs Workbook atau Nomor Jilid). Gunakan hash pendek deterministik (misal 6 karakter hex) atau slug cerdas tanpa pemotongan destruktif 30 karakter. Tambahkan unit test untuk memastikan seluruh judul Al-Wildan yang mirip menghasilkan kode unik.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Judul yang mirip seperti `PURE MATH 1 CAMBRIDGE AS&A LEVEL (COURSEBOOK)` dan `(WORKBOOK)` menghasilkan ISBN/kode buku unik berbeda.
- [ ] Buku TK seperti `MY PRESCHOOL WORLD - PHONICS READER 3` dan `READER 4` menghasilkan kode unik berbeda.
- [ ] Pengujian unit test di `isbn.test.ts` dan `book-import-parser.test.ts` lulus 100%.
- [ ] Penyelarasan deduplikasi di backend `importBookCatalog` dan frontend `BookBulkUploadModal`.
