# 01: System Setting & API Guard Mode Override Stok Demo

**What to build:**
Pengaturan sistem (`demo_stock_override_enabled`) yang tersimpan di `system_settings` (default: false), endpoint untuk membaca dan mengubah toggle (khusus Superadmin / Central Logistics), serta UI switch/toggle di halaman Pengaturan yang dilengkapi peringatan bahaya yang jelas. Ketika toggle nonaktif, seluruh endpoint mutasi stok override menolak aksi dengan status 403 Forbidden.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tambahkan konfigurasi `demo_stock_override_enabled` pada model / helper `system_settings` (nilai 'true' / 'false', default 'false').
- [ ] Endpoint `GET /api/settings/demo-mode` untuk membaca status override stok bagi staf berwenang.
- [ ] Endpoint `PATCH /api/settings/demo-mode` untuk mengaktifkan / menonaktifkan fitur dengan otorisasi peran pusat / superadmin.
- [ ] Tab / bagian baru "Fitur & Demo" di `SettingsView` dengan toggle switch, indikator status aktif/nonaktif, dan peringatan bahaya (warning alert).
- [ ] Middleware / helper guard `assertDemoStockOverrideEnabled` untuk melindungi endpoint mutasi stok override.
- [ ] Test unit dan route API (`bun test`) untuk verifikasi otorisasi, perubahan setting, dan proteksi guard.
