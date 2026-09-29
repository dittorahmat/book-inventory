## Why

Portal publik orang tua saat ini langsung melempar pengguna ke formulir murid baru ketika pencarian nama/NIS menghasilkan nol hasil (`usePublicOrder.handleSearch` memanggil `setIsNewStudentMode(true)` secara otomatis). Ortu yang typo atau memakai kata kunci yang salah merasa "diculik" ke form panjang tanpa titik keputusan, meningkatkan risiko pendaftaran duplikat dan kebingungan.

## What Changes

- Hasil pencarian kosong tidak lagi otomatis membuka formulir murid baru; sebagai gantinya tampil modal konfirmasi `Data Tidak Ditemukan` dengan echo query yang dicari.
- Modal menyediakan tiga aksi eksplisit: `Buat Siswa Baru` (masuk form + prefill nama), `Ubah Kata Kunci` (tutup + fokus kembali ke input search), `Batal` (tutup, tetap di Step 1, query dipertahankan).
- Prefill `newStudent.name` ditunda sampai pengguna mengonfirmasi `Buat Siswa Baru` (sebelumnya diisi saat search selesai).
- Backdrop click / tombol close diperlakukan sama dengan `Batal`; state popup dibersihkan saat reset flow dan pindah tab portal.

## Capabilities

### New Capabilities
- `public-order-student-search`: perilaku pencarian siswa portal publik saat hasil kosong, termasuk modal konfirmasi tiga aksi, aturan prefill tertunda, dan perilaku batal/ubah-kata-kunci.

### Modified Capabilities
- (none — tidak ada spec utama di `openspec/specs/` yang diubah; ini capability baru berbentuk delta spec)

## Impact

- Terpengaruh: `src/components/portal/usePublicOrder.ts` (state + handler search), `src/components/portal/StudentSearchStep.tsx` (render + trigger), `src/views/PublicOrderView.tsx` (wiring modal), komponen modal baru `src/components/portal/NoResultConfirmModal.tsx`, test `src/components/portal/*` / route terkait.
- Tidak ada perubahan API backend, skema DB, atau migrasi D1.
- Risiko rendah: perubahan murni frontend flow Step 1; perlu test regresi agar pencarian ketemu (hasil > 0) tidak terpengaruh.
