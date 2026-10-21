# Tasks

## 1. Helper Roles & Navigation Logic

- [x] 1.1 Implementasikan `getDefaultTabForRole(role)` dan `getRoleBadgeLabel(role)` di `src/lib/staff-roles.ts`, lalu buat unit test pendukung di `src/lib/staff-roles.test.ts`. Verifikasi dengan `bun test src/lib/staff-roles.test.ts`.
- [x] 1.2 Perbarui `DESKTOP_TABS` di `src/components/layout/AppTabsNavigation.tsx` agar role `warehouse_admin` memiliki akses penuh ke tab logistik buku dan seragam. Verifikasi dengan `bun run type-check`.

## 2. Navigasi Mobile & Header User Badge

- [x] 2.1 Refaktor `AppMobileNavigation` di `src/components/layout/AppTabsNavigation.tsx` agar menggunakan filter `visible(role)` yang sama dengan desktop alih-alih me-render tombol statis yang tidak sesuai role. Verifikasi via `bun run type-check`.
- [x] 2.2 Perbarui `AppHeader.tsx` untuk menggunakan `getRoleBadgeLabel(role)` agar staf gudang tidak lagi dilabeli "Branch Admin". Verifikasi via `bun run type-check`.

## 3. Reactive Routing & Tab Guard di App

- [x] 3.1 Pasang reactive redirect/guard di `src/App.tsx` agar saat sesi aktif dimuat atau role berubah, `activeTab` otomatis diarahkan ke `getDefaultTabForRole(role)` jika tab saat ini tidak ada dalam daftar tab yang diizinkan untuk rolenya.
- [x] 3.2 Jalankan verifikasi menyeluruh quality checklist (`bun run check:all`) untuk memastikan type safety, linting, file size (<400 baris), dan test suite tetap 100% hijau.
