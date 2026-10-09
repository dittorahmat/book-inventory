# Design: Refactor Grandfathered Monolithic Views

## Context
Repo mematuhi aturan §7 di `AGENTS.md` di mana setiap file sumber harus berukuran maksimal 400 baris kode.
Tiga file yang masih tersisa di `GRANDFATHERED`:
- `src/views/SettingsView.tsx` (~479 baris)
- `src/views/ProcurementView.tsx` (~427 baris)
- `src/App.tsx` (~446 baris)

## Architecture & Seams

### 1. Settings View Refactoring
- **State Seam**: Hook `useSettingsData` sudah tersedia di `src/components/settings/useSettingsData.ts`.
- **Sub-komponen Baru**:
  - `src/components/settings/SchoolsSettingsTab.tsx` (< 200 baris):
    - Input form tambah sekolah cabang.
    - Tabel daftar sekolah/kampus dan badge tipe lokasi.
  - `src/components/settings/UsersSettingsTab.tsx` (< 200 baris):
    - Input form tambah staf user dan assignment sekolah.
    - Tabel akun staf dan badge peran.
- **`SettingsView.tsx`**: Hanya mengelola tab header (`schools`, `users`, `smtp`, `whatsapp`, `cutoff`) dan mendelegasikan render ke masing-masing tab component. Estimasi ukuran: ~90 baris.

### 2. Procurement View Refactoring
- **Sub-komponen Baru**:
  - `src/components/procurement/PurchaseOrdersTable.tsx` (< 220 baris):
    - Search input dan filter status PO.
    - Render tabel PO dengan nomor PO, nama supplier, total nominal, status badge, dan tombol aksi workflow/print/receive.
- **`ProcurementView.tsx`**: Mengelola dialog state (`CreatePOModal`, `ReceivingModal`, `PODetailModal`, `PoPrintView`, `SupplierMasterSection`), dan memanggil `PurchaseOrdersTable`. Estimasi ukuran: ~220 baris.

### 3. App Root Layout Refactoring
- **Sub-komponen Baru**:
  - `src/components/layout/AppHeader.tsx` (< 150 baris):
    - Brand logo Al Wildan.
    - Session badge user (nama, role, tombol logout).
    - Mode toggle Staff vs Portal Publik.
  - `src/components/layout/AppTabsNavigation.tsx` (< 160 baris):
    - Tombol tab navigasi horizontal: Dashboard, Siswa, Pesanan, Paket, PO, Retur, Stok Satuan, Katalog, Transfer, Laporan, Pengaturan.
- **`App.tsx`**: Hanya memegang global session, school selector, tab state, dan switch case render view. Estimasi ukuran: ~180 baris.

## Verification Strategy
- Zero regressions on UX and behavior.
- `bun run type-check` (0 errors).
- `npm run lint` (0 errors).
- `npm run build` (sukses).
- `bun test` (semua 205 passing).
- `bun run check:file-size` (0 files over 400 lines, GRANDFATHERED array kosong).
