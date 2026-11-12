## Ringkasan Perubahan
Fitur pengaturan saldo akhir stok langsung (override stok demo) untuk buku satuan, paket buku, varian seragam, dan paket seragam guna mempermudah demonstrasi dan setup saldo awal tanpa harus melewati siklus PO / kitting / serah terima.

Closes #417, Closes #418, Closes #419.

### Rincian Implementasi & Perbaikan Review:
1. **System Setting & Mode Demo Guard (#417)**:
   - Toggle pengaturan `demo_stock_override_enabled` di `system_settings` (default `false`).
   - Komponen `DemoModeSettingsSection` di halaman Pengaturan.
   - Guard backend `assertDemoStockOverrideActive` pada seluruh endpoint override stok demo.
2. **Override Stok Buku (#418)**:
   - Endpoint `POST /api/demo/stock/book-override` & `POST /api/demo/stock/package-override`.
   - Menggunakan seam kanonik `moveInventoryStock` (movementType: `adjustment`) dan mencatat riwayat ke `stock_adjustments`.
   - Guard alokasi `targetQuantity >= reservedQuantity` melempar `AllocationViolationError` (HTTP 400).
   - Tombol inline `QuickSetStockButton` di sebelah angka stok pada `StockSummaryTable` dan `PackageCard`.
3. **Override Stok Seragam (#419)**:
   - Endpoint `POST /api/demo/stock/uniform-override` & `POST /api/demo/stock/uniform-package-override`.
   - Menggunakan seam kanonik `setVariantStockQuery` dan `setPackageStockQuery` di `uniform/stock`.
   - Guard alokasi pesanan aktif (`shipmentStatus = 'belum_dikirim'` & bukan `unpaid`) melempar `AllocationViolationError` (HTTP 400).
   - Tombol inline di katalog varian seragam dan perakitan paket seragam.
4. **Perbaikan Review Standards & Spec**:
   - `QuickSetStockButton`: Tombol submit tidak lagi memiliki atribut `disabled` pasif (§0.63), pesan error dikelola melalui `FormFieldFeedback` dan `FormSummaryAlert`, input memiliki visual error border rose serta auto-focus pada input yang salah.
   - Penerusan prop alokasi (`reservedQuantity`) dari tabel stok buku ke modal untuk validasi instan di browser.
   - Pembaruan aturan anti-kambuh pada `docs/rules/logistics-stock.md` (§0.62.7) dan tabel referensi `AGENTS.md`.

### Verifikasi Kualitas:
- `bun run check:all` 100% LULUS (786 tests pass across 174 files, semua 28 gate hijau).
