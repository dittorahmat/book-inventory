## Context

Lihat `proposal.md` (Why) dan `specs/parent-ordering/spec.md` (requirements). State saat ini: `GET /api/public/orders/search-students` sudah mengembalikan `gradeLevel/curriculumType/targetGradeLevel/detectedStatus`, `GET /api/packages` sudah mengembalikan `items[]` + `totalItemsCount`; tetapi `PublicOrderView.tsx` Step 2 me-render `packages.map(all)` dengan badge "Rekomendasi" dan tidak menampilkan `items[]`. Seed hanya punya 3 paket dan 4 siswa Kelas 1.

## Goals / Non-Goals

**Goals:**

- Step 2 menjadi locked single-package: resolve `(targetGradeLevel, curriculumType, academicYear)` di client dari daftar `/api/packages` yang sudah ada, tanpa API baru.
- Tampilkan rincian `items[]` paket terkunci + empty state hubungi admin.
- Seed demo menutup matriks demo (tambah paket + sebar siswa) + `docs/DEMO_SCENARIO.md` ditulis ulang untuk flow terkunci.

**Non-Goals:**

- Tidak ada endpoint `resolve-package` baru kecuali terbukti perlu saat implementasi (daftar paket kecil, filter client cukup).
- Tidak mengubah logika naik-kelas backend (`promoted -> +1`), status order, pembayaran, atau beasiswa.
- Tidak mengubah skema Drizzle (kolom sudah cukup).

## Decisions

- **Resolve paket di frontend (filter `packages` yang sudah di-fetch), bukan API baru.** Rationale: daftar paket < 50, data `items[]` sudah tersedia di client, menghindari round-trip + menjaga kompatibilitas Worker/D1. Alternatif (endpoint `GET /resolve-package?grade=&curriculum=`) ditolak kecuali paket membesar.
- **Kunci total, tanpa "ganti paket".** Rationale: keputusan user eksplisit (opsi 1 = kunci saja). `selectedPackageId` di-set sekali saat pilih/daftar siswa dan tidak ada UI list paket lagi. Alternatif (tampilkan 1 + link "ganti") ditolak.
- **Matching key = `(targetGradeLevel, curriculumType)` + prefer `academicYear` terbaru/aktif, fallback abaikan tahun jika hanya 1 kandidat.** Rationale: seed memakai `2026/2027` tetapi siswa lama bisa `2025/2026`; targetGrade yang menentukan. Alternatif (strict academicYear) berisiko empty state palsu.
- **Seed idempotent mengikuti pola existing (`select` -> `if empty` -> insert).** Rationale: `seed.ts` + `packages.ts` memakai auto-seed saat kosong; tambah `pkg-sd2-nas` (+ BOM 4 buku nasional) dan ~4 siswa baru (Kelas 2 INT promoted, Kelas 2 NAS active, Kelas 1 NAS promoted->2, dst) dengan NIS unik agar keyword demo deterministik. Alternatif (rewrite seed total) ditolak — jaga kompatibilitas order/PO/retur existing.
- **Demo doc menunjuk keyword stabil.** Rationale: Skenario 1 pakai `Hendra -> Kelas 2 INT` (existing), skenario baru pakai siswa NAS baru + 1 skenario empty state (mis. Kelas 3 NAS yang sengaja tanpa paket). Alternatif (acak) menyulitkan demo live.

## Risks / Trade-offs

- [Risk] Paket ganda untuk 1 key (mis. 2 revisi tahun ajaran) -> pilihan ambigu padahal UI dikunci. Mitigasi: aturan prefer tahun ajaran aktif + tasks mencatat test untuk kasus ini; jika muncul, tampilkan yang terbaru dan catat sebagai follow-up.
- [Risk] `packages` belum ke-load saat siswa dipilih (race `fetch /api/packages`). Mitigasi: resolve ulang saat `packages` berubah + state `resolving`; tombol lanjut disabled sampai resolve selesai.
- [Risk] Migrasi D1 remote tidak sinkron setelah tambah seed (error `no such column/table`). Mitigasi: ikuti AGENTS.md — `db:push` lokal, `db:generate` + `d1 execute --remote`, verifikasi sebelum commit.
- [Risk] Test existing (`public-orders.test.ts`, `packages.test.ts`) mengasumsikan list paket. Mitigasi: tambah test locked-match + empty state + ID string fleksibel, jangan hapus test lama.

## Migration Plan

1. Implement frontend lock + seed/demo-doc + tests di branch change ini.
2. `bun run db:push` (lokal) -> `bun run db:generate` -> `d1 execute --remote` untuk file migrasi (jika ada perubahan skema; jika hanya seed, eksekusi seed D1) -> `type-check` -> `lint` -> `build` -> `test`.
3. Rollback: revert commit change ini; seed idempotent sehingga data lama tetap valid (paket/siswa baru hanya tambahan `onConflictDoNothing`).
