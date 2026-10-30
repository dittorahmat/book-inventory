# 01: Master Konfigurasi Alamat Retur Gudang Pusat

**What to build:**
Konfigurasi alamat retur Gudang Pusat di menu Settings (Admin HQ/Logistics) via endpoint `GET/POST /api/settings/return-address` tersimpan di `system_settings` dan diekspos publik via `GET /api/public/settings/return-address` untuk dibaca form portal retur/pembatalan.

**Blocked by:**
None (can start immediately)

**Status:** ready-for-agent

- [ ] Schema / key `warehouse_return_address` di `system_settings`
- [ ] Endpoint `GET /api/settings/return-address` & `POST /api/settings/return-address` dengan auth admin
- [ ] Endpoint `GET /api/public/settings/return-address` publik aman
- [ ] UI section pengaturan alamat retur di Settings view
- [ ] Test route & gate check hijau
