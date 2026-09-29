## Why

Orang tua gagal pesan buku jalur reguler: klik "Konfirmasi & Kirim Pesanan" (Step 3) Tanner error teknis mentah `Unexpected token 'I', "Internal S..." is not valid JSON` — server mengembalikan plain-teks `Internal Server Error`, frontend langsung `res.json()` tanpa pengaman. Jalur beasiswa memakai kode submit yang sama sehingga patut diduga kena juga. Bersamaan dengan itu, tabel `students` belum punya UI admin dan siswa baru berstatus `new_pending` bisa langsung lanjut order tanpa verifikasi siapa pun.

## What Changes

- Portal order dihardening ujung-ke-ujung: `readJson()` tahan respons non-JSON (cek content-type, fallback pesan manusiawi), `errorMessage` di-clear tiap pindah step agar error lama tidak bocor ke Step 3.
- Backend mengembalikan envelope JSON untuk semua error (`onError` global) — tidak ada lagi plain-teks `Internal Server Error` ke portal publik.
- Dugaan pemicu 500 diverifikasi lalu diperbaiki: `Buffer.from()` di `public-orders.ts` (tidak tersedia di Cloudflare Workers) diganti decoder Worker-safe; urutan insert dibetulkan (`studentBookOrders` dulu, baru `orderPayments`); audit yang sama diterapkan ke jalur beasiswa (bukti beasiswa base64) dan retur publik.
- Tab admin baru "Database Siswa": tabel + pencarian (nama/NIS) + filter (sekolah, kelas, status) + tambah/edit, dengan isolasi cabang (`branch_admin` hanya sekolahnya).
- Verifikasi manual siswa baru: registrasi portal menciptakan `new_pending` + layar "menunggu verifikasi admin" (kunci total — tidak bisa lanjut ke Step 2); admin approve (input NIS resmi) / reject dari antrian; `search-students` menyembunyikan `new_pending`; `POST /submit` menolak `studentId` berstatus `new_pending` (403 + pesan jelas).
- Setiap endpoint mutasi sentiments test ID string fleksibel + skenario regresi di `*.test.ts` (sesuai AGENTS.md); migrasi D1 remote disinkronkan bila skema berubah.

## Capabilities

### New Capabilities

- `public-order-reliability`: Kontrak keandalan submit portal — envelope error JSON global, frontend tahan non-JSON dengan pesan manusiawi, decode base64 Worker-safe, urutan insert order-then-payment, berlaku untuk jalur reguler, beasiswa, dan retur publik.
- `student-database`: Master data siswa di panel admin (CRUD, pencarian, filter, isolasi cabang) plus antrian verifikasi manual (approve dengan NIS resmi / reject) dan gate `new_pending` di registrasi, pencarian, dan submit order portal.

### Modified Capabilities

(none — belum ada spec existing di `openspec/specs/`)

## Impact

- Frontend: `src/components/portal/portal-api.ts` (`readJson`), `usePublicOrder.ts` (clear error, layar tunggu verifikasi), `StudentSearchStep.tsx`, `PaymentStep.tsx`; `src/App.tsx` (tab baru) + view/komponen `StudentsView` baru (wajib patuh gate 300 baris + skill `design-taste-frontend`).
- Backend: `src/server/index.ts` (`onError` JSON), `src/server/routes/public-orders.ts` (decoder, urutan insert, gate `new_pending`), endpoint admin siswa baru (CRUD + approve/reject) atau perluasan `student-orders.ts`.
- Data: tambah kolom hanya bila perlu (mis. `rejected`); bila skema berubah, `bun run db:generate` + eksekusi migrasi ke D1 remote wajib sebelum commit.
- Tests: `public-orders.test.ts` (submit reguler/beasiswa dengan lampiran, tolak `new_pending`, respons error JSON), test baru endpoint admin siswa; `npm run type-check`, `lint`, `build`, `test`, `check:file-size` wajib hijau.
