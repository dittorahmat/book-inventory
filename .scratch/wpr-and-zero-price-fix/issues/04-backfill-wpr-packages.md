# 04: Backfill Idempoten Komponen WPR & Kalkulasi Ulang Seluruh Paket Buku

**What to build:**
Skrip backfill yang menelusuri seluruh data `book_packages` yang tersimpan di database. Jika ada paket buku yang belum memiliki baris WPR di `book_package_items`, skrip akan menambahkannya dan menghitung ulang harga paket secara otomatis melalui `recalcPackagePrice`.

**Blocked by:** 03: Penegakan WPR BOM Wajib pada Pembuatan & Impor Paket Buku

**Status:** ready-for-agent

- [ ] Skrip `scripts/backfill-wpr-packages.ts` dapat dieksekusi secara aman dan idempoten.
- [ ] Seluruh paket buku lama otomatis memiliki item WPR di tabel `book_package_items`.
- [ ] Total harga setiap paket buku terupdate secara all-in.
- [ ] Test otomatis memastikan hasil backfill konsisten.
