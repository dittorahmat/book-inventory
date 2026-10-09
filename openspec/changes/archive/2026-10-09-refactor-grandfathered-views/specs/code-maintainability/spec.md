# Capability: Code Maintainability

## ADDED Requirements

### Requirement: Complete Elimination of Grandfathered Files
Sistem harus memastikan bahwa seluruh file sumber TypeScript/TSX di direktori `src/` tidak melebihi batas 400 baris kode tanpa bergantung pada daftar pengecualian utang lama (`GRANDFATHERED`).

#### Scenario: File Size Gate Enforcement
- **Given** pemeriksaan file-size dijalankan melalui `bun run check:file-size`
- **When** seluruh file dalam direktori `src/` diperiksa
- **Then** tidak ada satu pun file sumber yang melebihi batas 400 baris kode
- **And** daftar `GRANDFATHERED` di `scripts/check-file-size.ts` kosong `[]`.

#### Scenario: Preservation of Settings UI & Operations
- **Given** pengguna membuka halaman pengaturan (`SettingsView`)
- **When** pengguna mengelola daftar cabang sekolah atau membuat akun staf baru
- **Then** data tersimpan dan tersaji dengan benar melalui sub-komponen `SchoolsSettingsTab` dan `UsersSettingsTab`.

#### Scenario: Preservation of Procurement Operations
- **Given** staf logistik membuka modul Pengadaan (`ProcurementView`)
- **When** staf memfilter, mencari nomor PO, atau membuka dialog rincian / penerimaan PO
- **Then** antarmuka tabel menyajikan data purchase order secara responsif melalui sub-komponen `PurchaseOrdersTable`.

#### Scenario: Preservation of Main Navigation & Layout
- **Given** pengguna menggunakan aplikasi antarmuka utama (`App.tsx`)
- **When** berpindah tab atau berganti sekolah cabang
- **Then** header dan tab navigasi berpindah dengan lancar melalui `AppHeader` dan `AppTabsNavigation`.
