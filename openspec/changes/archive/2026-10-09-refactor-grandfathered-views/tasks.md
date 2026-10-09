## 1. Dekomposisi SettingsView

- [x] 1.1 Ekstrak formulir tambah sekolah dan tabel cabang ke `src/components/settings/SchoolsSettingsTab.tsx`
- [x] 1.2 Ekstrak formulir tambah staf dan tabel pengguna ke `src/components/settings/UsersSettingsTab.tsx`
- [x] 1.3 Rampingkan `src/views/SettingsView.tsx` menjadi tab controller murni (<120 baris)

## 2. Dekomposisi ProcurementView

- [x] 2.1 Ekstrak tabel PO, search bar, dan status filter ke `src/components/procurement/PurchaseOrdersTable.tsx`
- [x] 2.2 Rampingkan `src/views/ProcurementView.tsx` menjadi view orchestrator (<250 baris)

## 3. Dekomposisi App.tsx

- [x] 3.1 Ekstrak navigasi bar tab ke `src/components/layout/AppTabsNavigation.tsx`
- [x] 3.2 Ekstrak header layout (user session, logout, logo) ke `src/components/layout/AppHeader.tsx`
- [x] 3.3 Rampingkan `src/App.tsx` menjadi state container (<200 baris)

## 4. Eliminasi GRANDFATHERED & Verifikasi

- [x] 4.1 Kosongkan array `GRANDFATHERED = []` di `scripts/check-file-size.ts`
- [x] 4.2 Jalankan `bun run check:file-size` dan pastikan lolos
- [x] 4.3 Jalankan `bun run type-check` (0 error)
- [x] 4.4 Jalankan `npm run lint` (0 error/warning)
- [x] 4.5 Jalankan `npm run build` dan `bun test`
