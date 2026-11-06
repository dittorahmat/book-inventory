# 01: Payload-Level Upsert Deduplication in `importBookCatalog`

**What to build:**
Perbaiki fungsi `importBookCatalog` di backend agar ketika satu payload impor memuat buku-buku dengan nomor ISBN yang sama berulang kali (internal duplicates), record kedua dan seterusnya tidak dimasukkan ulang ke antrean `toInsert` (yang memicu `UNIQUE constraint failed: books.isbn`), melainkan dialihkan menjadi update pada record yang sama secara aman sebelum dieksekusi ke database Cloudflare D1.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Pengiriman batch dengan duplikasi ISBN dalam satu payload tidak memicu `UNIQUE constraint failed: books.isbn`.
- [ ] Pengujian regresi di `src/server/routes/books-bulk.test.ts` memverifikasi skenario duplikasi ISBN internal dalam payload yang sama.
- [ ] Seluruh unit test buku tetap lulus 100%.
