## What to build

Penjualan buku satuan di kasir / walk-in (`POST /api/orders/direct`) memotong saldo `book_stocks` sekolah secara riil melalui `moveInventoryStock`. Pembuatan retur ke vendor (`POST /api/procurement/vendor-returns`) memotong saldo buku rusak/lebih dari `book_stocks` gudang via `moveInventoryStock`.

## Acceptance criteria

- [ ] Transaksi penjualan langsung kasir (`createDirectBookSaleOrder`) memotong saldo `book_stocks` sekolah untuk setiap item buku yang terjual menggunakan `moveInventoryStock` (`movementType: 'handover'`).
- [ ] Mutasi retur pembelian vendor (`POST /api/procurement/vendor-returns`) memotong saldo `book_stocks` di gudang logistik asal retur via `moveInventoryStock` (`movementType: 'adjustment'` / return).
- [ ] Operasi tetap berhasil ketika alokasi menghasilkan ID sintetis agregat (`aggr-...`) tanpa bergantung pada keberadaan baris di `book_items`.
- [ ] Test `direct-sales.test.ts` dan `vendor-returns.test.ts` memverifikasi saldo akhir `book_stocks` terpangkas akurat.

## Blocked by

- None (can start immediately)
