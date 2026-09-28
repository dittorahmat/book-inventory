## Why

Orang tua salah paham di portal pemesanan: hasil search siswa tidak menonjolkan Kelas + Kurikulum, dan layar paket masih menampilkan semua paket untuk dipilih manual (hanya badge "Rekomendasi"). User meminta flow terkunci: search -> 1 paket otomatis -> tampil rincian isi buku.

## What Changes

- Hasil search siswa di portal menonjolkan Kelas (current -> target naik kelas) + Kurikulum + Sekolah sebagai info utama tiap baris hasil.
- Layar paket buku berubah dari "pilih paket manual" menjadi "detail paket terkunci": 1 paket hasil auto-match `(targetGradeLevel, curriculumType, academicYear)` ditampilkan beserta rincian `items[]` (judul, ISBN, qty).
- Tidak ada dropdown / klik ganti paket di Step 2 (kunci total sesuai keputusan user).
- Jika tidak ada paket cocok: empty state "Paket belum tersedia, hubungi admin sekolah" + tombol kembali Ubah Murid.
- Data demo disebar: siswa mencakup kombinasi Kelas x Kurikulum (INT/NAS) dan paket pelengkapnya, plus skenario demo di `docs/DEMO_SCENARIO.md` ditulis ulang untuk flow terkunci.

## Capabilities

### New Capabilities

- `parent-ordering`: Flow pemesanan portal orang tua — enriched student search result, locked single-package resolution, package detail + empty state, dan skenario demo terkait.

### Modified Capabilities

(none — belum ada spec existing di `openspec/specs/`)

## Impact

- Frontend: `src/views/PublicOrderView.tsx` (Step 1 hasil search, Step 2 locked detail + empty state).
- Backend (kemungkinan kecil): `src/server/routes/public-orders.ts` (`GET /search-students` — pastikan `gradeLevel/curriculumType/targetGradeLevel` selalu terisi), `src/server/routes/packages.ts` (konsumsi `items[]` yang sudah ada, tanpa API baru kecuali perlu `resolve-package`).
- Data: `src/server/seed.ts` (tambah paket mis. SD2-NAS + sebar siswa INT/NAS per kelas), migrasi D1 remote wajib sinkron.
- Docs: `docs/DEMO_SCENARIO.md` (Skenario 1 ditulis ulang + skenario empty state).
- Tests: `src/server/routes/public-orders.test.ts`, `src/server/routes/packages.test.ts` (match 1 paket, paket tidak ketemu, ID string fleksibel).
