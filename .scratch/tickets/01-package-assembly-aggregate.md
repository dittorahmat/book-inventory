## What to build

Memungkinkan staf Gudang Pusat merakit dan membongkar paket buku dari stok agregat (`book_stocks` dan `package_stocks`). Perakitan paket (`POST /api/packages/:id/bundle`) memvalidasi ketersediaan komponen dari saldo agregat `book_stocks` dan memotong/menambah saldo via `moveInventoryStock`, bukan memvalidasi ketiadaan baris fisik di `book_items`. Pembongkaran paket (`unbundle`) memulihkan saldo ke `book_stocks`. Baris fisik di `book_items`/`package_items` hanya diperbarui secara graceful jika baris barcode lama memang ada.

## Acceptance criteria

- [ ] Perakitan paket berhasil ketika stok komponen di `book_stocks` mencukupi, meskipun `book_items` tidak memiliki baris fisik barcode (mengatasi error: `Insufficient stock for "..." Required: X, Available: 0`).
- [ ] Mutasi perakitan paket memotong saldo `book_stocks` komponen BOM dan menambah saldo `package_stocks` secara atomik via seam `moveInventoryStock`.
- [ ] Pembongkaran paket (`disassemblePackageBundles`) memvalidasi ketersediaan dari `package_stocks` dan mengembalikan saldo ke `book_stocks` via `moveInventoryStock`.
- [ ] Jika baris fisik `book_items` atau `package_items` tersedia, statusnya tetap diperbarui (`disposed`/`in_stock`) tanpa menggagalkan perakitan berbasis agregat.
- [ ] Unit & integration test `packages.test.ts` dan `order-fulfilment.test.ts` hijau.

## Blocked by

- None (can start immediately)
