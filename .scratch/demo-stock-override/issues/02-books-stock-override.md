# 02: Vertical Slice Set Stok Buku (Satuan & Paket)

**What to build:**
Aksi pengaturan saldo akhir stok buku (satuan dan paket) secara langsung tanpa melalui PO atau perakitan fisik. Tombol inline interaktif muncul tepat di samping angka jumlah stok pada tabel inventori buku ketika mode demo aktif. Mutasi dieksekusi melalui seam kanonik `moveInventoryStock` (tipe `adjustment`), mencatat riwayat ke `stock_adjustments`, dan divalidasi dengan guard `target_quantity >= allocated_quantity`.

**Blocked by:** 01: System Setting & API Guard Mode Override Stok Demo

**Status:** ready-for-agent

- [ ] Endpoint `POST /api/books/stock/override` untuk buku satuan: menerima `{ schoolId, bookId, targetQuantity }`, memvalidasi setting aktif, memastikan `targetQuantity >= reservedQuantity`, dan mengeksekusi mutasi delta via `moveInventoryStock`.
- [ ] Endpoint `POST /api/packages/stock/override` untuk paket buku: menerima `{ schoolId, packageId, targetQuantity }`, memvalidasi setting aktif, memastikan `targetQuantity >= reservedQuantity`, dan mengeksekusi mutasi delta via `moveInventoryStock`.
- [ ] Catatan audit log pada `stock_adjustments` dengan reason otomatis `"Manual Override (Mode Demo) dari <stok_lama> ke <stok_baru>"`.
- [ ] Tombol inline edit/set stok di sebelah angka jumlah stok pada tabel `InventoryView` (Buku Satuan) dan `PackagesView` (Paket Buku) yang hanya tampil saat setting On.
- [ ] Dialog / popover ringkas untuk input `targetQuantity` dengan feedback validasi instan jika angka di bawah stok teralokasi.
- [ ] Test unit dan integration (`bun test`) untuk mutasi buku satuan & paket, verifikasi guard penolakan saat setting Off, dan penolakan saat target lebih kecil dari alokasi pesanan aktif.
