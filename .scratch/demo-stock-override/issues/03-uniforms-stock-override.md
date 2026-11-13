# 03: Vertical Slice Set Stok Seragam (Satuan & Paket)

**What to build:**
Aksi pengaturan saldo akhir stok seragam (varian satuan dan paket rakitan) secara langsung tanpa melalui siklus PO atau perakitan fisik. Tombol inline interaktif muncul tepat di samping angka jumlah stok pada tabel inventori seragam ketika mode demo aktif. Mutasi dieksekusi melalui seam kanonik seragam (`uniform/stock`), mencatat log audit, dan memvalidasi `target_quantity >= allocated_quantity`.

**Blocked by:** 01: System Setting & API Guard Mode Override Stok Demo

**Status:** ready-for-agent

- [ ] Endpoint `POST /api/uniforms/stock/override` untuk varian seragam: menerima `{ variantId, size, targetQuantity }`, memvalidasi setting aktif, memastikan target stok tidak melanggar pesanan aktif, dan mengeksekusi seam `setVariantStockQuery` / `adjustVariantStockQuery`.
- [ ] Endpoint `POST /api/uniform-packages/stock/override` untuk paket seragam: menerima `{ packageId, targetQuantity }`, memvalidasi setting aktif, dan mengeksekusi seam `setPackageStockQuery` / `adjustPackageStockQuery`.
- [ ] Pencatatan log audit mutasi seragam dengan metadata petugas dan reason `"Manual Override (Mode Demo)"`.
- [ ] Tombol inline edit/set stok di sebelah angka jumlah stok pada tabel `UniformView` (bagian Satuan/Varian dan bagian Paket Seragam) yang hanya tampil saat setting On.
- [ ] Dialog / popover ringkas untuk input `targetQuantity` dengan validasi instan.
- [ ] Test unit dan integration (`bun test`) untuk mutasi seragam satuan & paket, verifikasi guard penolakan saat setting Off, dan penolakan saat target lebih kecil dari alokasi pesanan aktif.
