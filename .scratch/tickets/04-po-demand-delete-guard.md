## What to build

Kalkulasi otomatis kebutuhan PO buku (`calculateBookDemandSummary`) membaca sisa stok gudang dari `book_stocks` untuk mencegah over-ordering ke vendor. Penghapusan master buku (`DELETE /api/books/:id`) memvalidasi saldo aktif `book_stocks` di seluruh cabang dan gudang untuk mencegah penghapusan buku yang stok fisiknya masih ada.

## Acceptance criteria

- [ ] `calculateBookDemandSummary` di `demand.ts` menghitung stok lepas gudang dari tabel agregat `book_stocks` (dengan fallback ke `book_items` jika belum tercatat di agregat).
- [ ] Rekomendasi kuantitas PO memperhitungkan stok fisik yang ada di `book_stocks` Gudang Logistik.
- [ ] `DELETE /api/books/:id` menolak penghapusan buku jika total `book_stocks.availableQuantity` atau `book_stocks.reservedQuantity` > 0 di sekolah/gudang mana pun.
- [ ] Unit test `procurement.test.ts` dan `books.test.ts` memverifikasi kedua perilaku ini.

## Blocked by

- None (can start immediately)
