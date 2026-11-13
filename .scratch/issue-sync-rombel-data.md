## What to build

Memperbarui skrip backfill siswa AW 1 dan mengeksekusi sinkronisasi ulang data 713 murid SD Al-Wildan 1 dari file Excel sumber (`DATA SISWA SD AL-WILDAN 1 TP. 2026-2027.xlsm`) ke database lokal (`inventory.db`) dan Cloudflare D1 remote (`book-inventory-db`), sehingga seluruh data murid di production memiliki atribut ruang kelas lengkap berjenjang (`1 INTER 1`, `2 INTER 1`, dsb.).

## Acceptance criteria

- [ ] Skrip `scripts/backfill-student-rombel-alw1.ts` diperbarui untuk menghasilkan query UPDATE dengan format ruang kelas berjenjang (`1 INTER 1`, dst.).
- [ ] Database lokal (`inventory.db`) sukses diperbarui untuk 713 siswa aktif SD Al-Wildan 1.
- [ ] Database remote Cloudflare D1 (`book-inventory-db`) sukses diperbarui via batch runner kanonik Bun (`db-d1-exec`).
- [ ] Query verifikasi D1 remote memastikan 100% siswa aktif AW 1 terisi rombel dengan prefix jenjang lengkap dan 0 record rombel tanpa jenjang.

## Blocked by

- #451
