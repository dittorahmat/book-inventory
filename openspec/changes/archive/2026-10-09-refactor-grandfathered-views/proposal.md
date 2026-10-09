# Proposal: Refactor Grandfathered Monolithic Views

## Why
Codebase memiliki aturan file-size gate maksimal 400 baris per file (`scripts/check-file-size.ts`, AGENTS.md §7).
Saat ini masih tersisa 3 file monolitik di daftar `GRANDFATHERED`:
1. `src/views/SettingsView.tsx` (479 baris) — form pembuatan cabang sekolah dan modal akun staf tercampur dalam satu file view.
2. `src/views/ProcurementView.tsx` (427 baris) — tabel PO dan dialog manajemen supplier masih menyatu.
3. `src/App.tsx` (446 baris) — header navigasi, manajemen sesi login/logout, tab switching, dan selektor cabang sekolah tercampur dalam root layout.

Dengan melunasi utang teknis ini, seluruh file dalam codebase akan memenuhi standar <= 400 baris kode dan daftar `GRANDFATHERED` di `scripts/check-file-size.ts` dapat dikosongkan secara total (0 grandfathered files).

## What Changes
1. **Dekomposisi `SettingsView.tsx`**:
   - Ekstrak subkomponen form dan tabel cabang ke `src/components/settings/SchoolsSettingsTab.tsx`.
   - Ekstrak subkomponen form dan tabel staf admin ke `src/components/settings/UsersSettingsTab.tsx`.
   - Rampingkan `SettingsView.tsx` menjadi tab controller murni (<120 baris).

2. **Dekomposisi `ProcurementView.tsx`**:
   - Ekstrak tabel Purchase Orders dan filter header ke subkomponen `src/components/procurement/PurchaseOrdersTable.tsx`.
   - Rampingkan `ProcurementView.tsx` menjadi view orchestrator (<250 baris).

3. **Dekomposisi `App.tsx`**:
   - Ekstrak navigasi bar atas & tab navigasi ke `src/components/layout/AppNavigation.tsx`.
   - Ekstrak header sesi pengguna & logout dialog ke `src/components/layout/AppHeader.tsx`.
   - Rampingkan `App.tsx` menjadi state container dan view switcher (<200 baris).

4. **Eliminasi `GRANDFATHERED`**:
   - Kosongkan array `GRANDFATHERED = []` di `scripts/check-file-size.ts`.
   - Verifikasi melalui `bun run check:file-size`, `bun run type-check`, `npm run lint`, dan `bun test`.

## Capabilities

### New Capabilities
None (pure refactoring with identical UX/behavior).

### Modified Capabilities
- `code-maintainability`: Menjamin seluruh file sumber di codebase patuh batas 400 baris kode tanpa perkecualian utang lama.

## Impact
- Semua fungsionalitas UI, form registrasi sekolah/staf, procurement, dan navigasi tab tetap berjalan 100% identik tanpa perubahan alur logika maupun API.
