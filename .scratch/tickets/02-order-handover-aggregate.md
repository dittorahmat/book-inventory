## What to build

Staf cabang dapat menyerahkan paket buku ke siswa (`POST /api/orders/:id/handover`) secara manual tanpa scan barcode tanpa diblokir oleh ketiadaan baris fisik di `package_items`. Sistem memvalidasi ketersediaan dari `package_stocks` dan memotong saldo paket cabang secara otomatis via seam `moveInventoryStock`.

## Acceptance criteria

- [ ] Serah terima paket tanpa barcode (`handoverWithoutBarcode`) berhasil jika sekolah memiliki saldo cukup di `package_stocks`, meskipun `package_items` kosong.
- [ ] Mutasi serah terima memotong kuantitas `package_stocks` cabang sebesar 1 via `moveInventoryStock` (`movementType: 'handover'`).
- [ ] Jika baris fisik `package_items` tersedia di sekolah, baris tersebut tetap ditandai `delivered` dan dihubungkan ke pesanan; jika tidak ada, pesanan tetap tercatat `picked_up` dengan `assignedPackageItemId: null`.
- [ ] Unit & integration test handover di `order-fulfilment.test.ts` dan `student-orders.test.ts` hijau.

## Blocked by

- None (can start immediately)
