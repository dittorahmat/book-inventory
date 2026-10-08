## 1. Delete & Data Cleanup across Key Modules

- [x] 1.1 Implementasi logic auto-unbundle dan endpoint `DELETE /api/packages/:id` di `packages.ts` & `package-assembly.ts`, verifikasi dengan test case baru di `packages.test.ts`
- [x] 1.2 Tambahkan tombol aksi hapus pada baris paket di `PackagesView.tsx` dengan modal dialog konfirmasi, dan verifikasi UI me-refresh daftar paket setelah dihapus
- [x] 1.3 Tambahkan endpoint & tombol delete untuk Pesanan Siswa (`DELETE /api/student-orders/:id`) di `student-orders.ts` & `StudentOrdersView.tsx`
- [x] 1.4 Tambahkan endpoint & tombol delete untuk Siswa (`DELETE /api/students/:id`) di `students.ts` & `StudentTable.tsx`
- [x] 1.5 Tambahkan endpoint & tombol delete untuk Transfer (`DELETE /api/shipments/:id`) di `shipments.ts` & `TransfersView.tsx` (khusus draft/unfinalized)
- [x] 1.6 Tambahkan tombol delete untuk Katalog Buku di `CatalogView.tsx` (`DELETE /api/books/:id`) jika belum ada / pasang tombolnya

## 2. Integritas Perhitungan Stok Satuan & Dropdown Kelas

- [x] 2.1 Perbaiki kalkulasi `totalQty` di `src/server/services/stock-kernel.ts` agar mengabaikan status `disposed`, verifikasi unit test `stock-kernel.test.ts` dan test unbundle
- [x] 2.2 Lengkapi opsi dropdown kelas 1–12 (SD 1–6, SMP 7–9, SMA 10–12) di `src/components/portal/StudentSearchStep.tsx` dan pastikan tersimpan dengan benar saat pendaftaran

## 3. Validasi Fail-Closed Serah Terima (Handover)

- [x] 3.1 Perketat fungsi `handoverPackage` di `src/server/services/order-fulfilment.ts` untuk memvalidasi ketersediaan stok fisik di cabang (return 400 jika stok habis), verifikasi dengan test di `order-fulfilment.test.ts`
- [x] 3.2 Pastikan `StudentOrdersView.tsx` menangani dan menampilkan pesan error peringatan stok tidak mencukupi secara jelas kepada pengguna

## 4. Alur Transfer Antarcabang Cepat & Filter Status

- [x] 4.1 Tambahkan opsi `instant?: boolean` pada `createShipment` di backend `shipments.ts` dan `shipment-write.ts`, verifikasi unit test di `shipments.test.ts`
- [x] 4.2 Tambahkan tombol aksi langsung (`Dispatch` / `Receive`) pada kartu pengiriman di `TransfersView.tsx` dan toggle `Transfer Langsung (Instan)` pada form pembuatan
- [x] 4.3 Tambahkan tab/pill filter status pengiriman (`Semua`, `Draft`, `In Transit`, `Completed`) di `TransfersView.tsx` agar daftar transfer rapi dan tidak menumpuk
- [x] 4.4 Jalankan full regression suite (`bun test`, `bun run check:file-size`, `bun run type-check`) untuk memverifikasi seluruh integrasi
