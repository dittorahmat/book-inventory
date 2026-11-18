# 01: Portal Publik Judul Buku Fallback ke Judul Asli & Sembunyikan Harga Satuan Paket

**What to build:**
1. Pada portal publik pemesanan buku (`/api/public/packages`, `/api/public/book-choices`, dan `/api/public/satuan-catalog`), jika kolom `publicTitle` buku bernilai kosong atau `null`, sistem otomatis menggunakan judul asli buku (`book.title`) sebagai fallback (bukan teks seragam `"Buku Paket"`).
2. Pada tampilan rincian isi paket (`PackageBreakdown`) di portal orang tua, harga satuan per judul buku tidak ditampilkan sama sekali. Yang ditampilkan hanya judul buku dan kuantitas eksemplar (`X eks`). Total harga paket tetap ditampilkan pada kartu paket & ringkasan pembayaran.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Judul buku pada DTO `/api/public/packages` dan `/api/public/book-choices` menggunakan fallback `it.publicTitle?.trim() || it.title` (tetap mempertahankan `WPR_TITLE` untuk WPR).
- [x] Judul buku pada DTO katalog satuan terbuka `/api/public/satuan-catalog` menggunakan `b.publicTitle?.trim() || b.title`.
- [x] Komponen `PackageBreakdown` tidak lagi merender harga satuan buku di dalam rincian paket.
- [x] Unit test `PackageBreakdown.test.tsx` dan integration test `public-orders.test.ts` memverifikasi kedua perilaku ini.
- [x] Seluruh gate `bun run check:fast` hijau nol error.
