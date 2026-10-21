# Proposal

## Why

Saat ini terdapat ketidakkonsistenan pada navigasi dan Role-Based Access Control (RBAC) frontend. Ketika pengguna dengan role `warehouse_uniforms_admin` (Admin Gudang Seragam) login, state tab aktif default diinisialisasi ke `"dashboard"`. Karena tab dashboard tidak ada di daftar tab yang diizinkan untuk Admin Seragam dan view dashboard gagal merender sekolah non-cabang, aplikasi terjatuh ke tab pemesanan paket ke gudang (`internal_orders`) yang bukan wewenangnya.

Selain itu, header aplikasi masih salah melabeli semua staf non-pusat sebagai "Branch Admin" (termasuk admin gudang), navigasi mobile (`AppMobileNavigation`) belum memfilter tombol berdasarkan role, dan role `warehouse_admin` (gudang umum) kehilangan tab-tab logistik buku. Perubahan ini menstandarkan pemetaan role ke modul, routing tab default berbasis role, dan penegakan batas akses di antarmuka staf.

## What Changes

- **Role Default Tab & Guard**: Implementasikan helper kanonik `getDefaultTabForRole(role)` dan pasang validasi guard di `App.tsx` agar pengguna selalu diarahkan ke tab pertama yang sah sesuai rolenya saat login, serta dicegah mengakses tab yang tidak diizinkan.
- **Isolasi Modul Gudang Seragam**: Pastikan `warehouse_uniforms_admin` hanya mendarat di tab `"uniforms"` dan tidak dapat melihat maupun mengakses tab pesanan cabang/buku.
- **Koreksi Tab Gudang Umum (`warehouse_admin`)**: Pastikan role `warehouse_admin` dapat mengakses tab buku maupun seragam sesuai definisinya sebagai Admin Gudang Umum.
- **Sinkronisasi Navigasi Mobile (`AppMobileNavigation`)**: Filter daftar tombol navigasi mobile berdasarkan izin `role` pengguna yang sedang aktif, identik dengan navigasi desktop.
- **Koreksi Label Header Staf (`AppHeader`)**: Tampilkan nama/badge role yang akurat pada header (HQ Central Admin, Admin Gudang Seragam, Admin Gudang Buku, Admin Gudang Umum, atau Branch Admin) alih-alih melabeli semua non-pusat sebagai Branch Admin.

## Capabilities

### New Capabilities
- `staff-rbac-navigation`: Penegakan otorisasi modul frontend, routing tab default per role, dan sinkronisasi navigasi desktop/mobile untuk staf sekolah dan logistik.

### Modified Capabilities
<!-- Tidak ada perubahan requirement spec lama, fungsionalitas pengadaan/seragam/siswa tetap sama -->

## Impact

- Frontend: `src/App.tsx`, `src/components/layout/AppTabsNavigation.tsx`, `src/components/layout/AppHeader.tsx`, `src/lib/staff-roles.ts`.
- Tampilan UI: Navigasi desktop, navigasi mobile, dan header profil pengguna.
- Tests: Penambahan unit test untuk helper penentuan tab default role dan visibility navigasi tab.
