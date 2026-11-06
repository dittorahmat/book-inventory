# 02: Resilient Drive Fetcher & Graceful Non-Catalog Sheet Handling

**What to build:**
Perbaiki backend route `/api/books/parse-drive-url` dan `drive-service`:
1. Tambahkan retry mechanism dengan exponential backoff pada `fetchGoogleDriveResource` saat Google mengembalikan status 503 / 429.
2. Ketika spreadsheet adalah rekapan ringkasan harga paket (seperti file `A. DAFTAR DAN HARGA PAKET BUKU...` yang hanya berisi kolom KELAS & BIAYA BUKU dan bukan daftar judul buku satuan), jangan melempar unhandled Error / HTTP 500. Kembalikan respons terstruktur dengan warning informatif bahwa file dilewati karena berformat ringkasan paket, sehingga proses batch runner dapat terus berjalan dengan mulus.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] File ringkasan harga paket tidak memicu error 500 melainkan dilewati secara graceful dengan pesan peringatan yang jelas.
- [ ] Pengunduhan dari Google Drive memiliki mekanisme retry 3x dengan backoff saat terjadi throttling 503/429.
- [ ] Test di `books-bulk.test.ts` dan `drive-service.test.ts` memverifikasi skenario ini.
