## 1. Portal Terkunci (Frontend)

- [x] 1.1 Tampilkan Kelas + Kurikulum sebagai info utama tiap baris hasil search (nama, NIS, Kelas saat ini -> target, Internasional/Nasional, sekolah) dan verifikasi manual dengan keyword "Hendra" menampilkan info tersebut
- [x] 1.2 Ganti Step 2 dari daftar semua paket menjadi locked single-package hasil match `(targetGradeLevel, curriculumType, prefer academicYear)` tanpa UI ganti paket, dan verifikasi memilih siswa langsung mengunci 1 paket yang benar
- [x] 1.3 Render rincian `items[]` paket terkunci (judul, ISBN, qty, total item, harga) di Step 2 dan verifikasi Paket Kelas 2 INT menampilkan daftar bukunya sebelum tombol bayar
- [x] 1.4 Tambahkan empty state "Paket belum tersedia, hubungi admin sekolah" + tombol Ubah Murid (tanpa tombol lanjut) saat tidak ada paket cocok, dan verifikasi dengan siswa target Kelas tanpa paket

## 2. Data Demo + Dokumen

- [x] 2.1 Tambah paket pelengkap demo (min. `PKG-SD2-NAS` + BOM) secara idempotent di `seed.ts` dan verifikasi `GET /api/packages` mengembalikannya
- [x] 2.2 Sebar siswa demo menutup matriks (Kelas 1/2 x INT/NAS, termasuk 1 promoted dan NIS/keyword unik) dan verifikasi tiap kombinasi demo me-resolve tepat 1 paket
- [x] 2.3 Tulis ulang Skenario 1 `docs/DEMO_SCENARIO.md` untuk flow terkunci + tambah skenario empty state dengan keyword/NIS yang sesuai seed, dan verifikasi langkah bisa diikuti end-to-end tanpa menebak data

## 3. Regresi + Quality Gates

- [x] 3.1 Tambah/ubah test `public-orders` + `packages` untuk locked-match, empty state, dan payload ID string custom (`z.string().min(1)`, bukan UUID kaku), dan verifikasi `npm run test` lolos
- [x] 3.2 Jalankan quality checklist AGENTS.md (`db:push`, migrasi D1 remote + verifikasi, `type-check` 0 error, `lint`, `build`) dan verifikasi semua hijau sebelum handoff implementasi

## 4. Tindak Lanjut (atas permintaan user saat implementasi)

- [x] 4.1 Refactor `PublicOrderView.tsx` (1411 baris) menjadi `src/components/portal/` (`StudentSearchStep`, `LockedPackageStep`, `PaymentStep`, `OrderSuccessStep`, `ReturnReportTab`, `usePublicOrder`, `useReturnFlow`, `portal-api`) + `src/lib/portal-types.ts`, semua file <= 300 baris, dan verifikasi `type-check` + `lint` + `build` + `test` hijau
- [x] 4.2 Seed demo lokal (`data/inventory.db` via `runIdempotentSeed`) dan verifikasi 4 paket + BOM 8/4/8/4 + 8 siswa + join search Hendra
- [x] 4.3 Sinkron `drizzle/seed-d1.sql` (sekolah + `PKG-SD2-NAS` + BOM SD2 + 4 siswa baru), eksekusi `--remote`, dan verifikasi 4 paket + 8 siswa + join search Hendra di D1
- [x] 4.4 Hardening AGENTS.md aturan 7 (file-size gate WAJIB 300 baris + `bun run check:file-size` via `scripts/check-file-size.ts` + script di `package.json`) dan verifikasi gate hijau
