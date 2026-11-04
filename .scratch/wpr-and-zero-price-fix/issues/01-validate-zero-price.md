# 01: Validasi Harga Nol Katalog Buku saat Import

**What to build:**
Memvalidasi baris katalog buku saat proses impor berlangsung. Baris yang memiliki harga jual kurang dari atau sama dengan 0 (termasuk kosong atau format non-numerik tak valid) akan ditolak dan dialihkan ke daftar baris gagal (`skippedRows`) dengan alasan `"Harga buku tidak boleh Rp 0 atau kosong"`. Mencegah tersimpan/masuknya buku seharga Rp 0 ke database katalog.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Parser `book-import-parser.ts` menolak baris dengan harga <= 0 ke `skippedRows`.
- [ ] Baris yang ditolak tidak masuk ke daftar `validBooks`.
- [ ] Unit test `book-import-parser.test.ts` memverifikasi penolakan harga Rp 0.
