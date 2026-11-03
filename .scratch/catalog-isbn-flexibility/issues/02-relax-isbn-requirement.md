# 02: Relaksasi ISBN Menjadi Opsional & Fleksibel pada Endpoint Katalog Buku

**What to build:**
Endpoint POST `/api/books` tidak lagi mensyaratkan ISBN kaku minimal 10 digit. Jika user mengisi ISBN/kode buku (minimal 1 karakter non-kosong), gunakan kode tersebut. Jika dikosongkan (undefined/null/string kosong), server secara otomatis meng-generate identifier ISBN unik fallback bertanda unik (misal `AUTO-...`) agar integritas kolom SQLite/D1 yang `notNull().unique()` tetap terpenuhi tanpa merusak schema database remote.

**Blocked by:** 01-extract-zod-error-messages

**Status:** ready-for-agent

- [ ] `createBookSchema` di `src/server/routes/books.ts` melonggarkan field `isbn` (opsional atau string non-empty)
- [ ] Handler POST `/api/books` melakukan fallback generation untuk nomor ISBN unik jika kosong
- [ ] Pengecekan duplikasi ISBN hanya dievaluasi jika ISBN diisi manual oleh user atau terhadap kode yang dihasilkan
- [ ] Unit test di `src/server/routes/books.test.ts` memverifikasi pendaftaran buku tanpa ISBN dan dengan ISBN pendek (<10 digit) berhasil disimpan
