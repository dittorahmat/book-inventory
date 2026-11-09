## What to build

Pembuatan rencana pengiriman transfer antar-cabang (`POST /api/shipments`) dapat menerima ID alokasi sintetis stok agregat (`aggr-...`) tanpa melempar error `Some book items do not exist` atau `Some packages do not exist`. Mutasi pengiriman dan penerimaan transfer antar cabang memutasi saldo `book_stocks` dan `package_stocks` secara terpadu.

## Acceptance criteria

- [ ] `planShipment` di `shipment/plan.ts` mengenali baris kuantitas agregat dari `allocateInventoryStock` tanpa melakukan verifikasi keberadaan baris fisik di `book_items`/`package_items` untuk ID sintetis.
- [ ] Pengiriman (`dispatch`) dan penerimaan (`receive`) mutasi surat jalan transfer antar-cabang memutasi saldo `book_stocks` dan `package_stocks` via seam `moveInventoryStock`.
- [ ] Integration test transfer shipment di `shipments.test.ts` berhasil untuk mode alokasi kuantitas agregat.

## Blocked by

- #369 (Perakitan & Pembongkaran Paket Berbasis Stok Agregat)
