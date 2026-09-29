## 1. Backend — keandalan submit portal

- [x] 1.1 Tambah `app.onError()` JSON global di `src/server/index.ts` dan verifikasi respons 500 berupa `{ success: false, message }` tanpa stack trace (uji via request pemicu error di `bun test`)
- [x] 1.2 Buat helper `decodeBase64ToBytes()` Worker-safe (tanpa `Buffer`) dan pakai di 3 titik `public-orders.ts` (beasiswa, pembayaran, retur); verifikasi tidak ada lagi referensi `Buffer` di route tersebut (`grep Buffer src/server/routes/public-orders.ts` kosong)
- [x] 1.3 Balik urutan insert submit menjadi order-dulu-payment-kemudian dan verifikasi skenario reguler lunas + parsial hijau di `public-orders.test.ts`
- [x] 1.4 Tambah skenario beasiswa (tanpa dokumen → 400, dengan dokumen base64 → 201 + `scholarship_pending` + `totalAmount` 0) dan verifikasi test-nya lolos

## 2. Backend — gate verifikasi siswa

- [x] 2.1 Tambah `rejected` ke enum status `students` + filter `search-students` mengecualikan `new_pending`/`rejected`; verifikasi pencarian siswa pending mengembalikan kosong di test
- [x] 2.2 `POST /submit` menolak student non-`active`/`promoted` dengan 403 JSON; verifikasi test submit paksa dengan siswa pending → 403 dan tidak ada order tercipta
- [x] 2.3 Buat router admin `src/server/routes/students.ts` (list + filter + CRUD + `POST /:id/verify { approve|reject, nis }`, approve wajib NIS resmi, branch isolation di query) dan verifikasi tiap endpoint mutasi lolos dengan ID string kustom maupun UUID di test baru `students.test.ts`

## 3. Frontend — hardening portal

- [x] 3.1 Perkuat `readJson()` di `portal-api.ts` (cek content-type + try/catch → pesan manusiawi per operasi) dan verifikasi pesan `Unexpected token ... is not valid JSON` tidak pernah muncul ke user (simulasi respons non-JSON di semua 7 call-site)
- [x] 3.2 Clear `errorMessage` setiap pindah step/tab dan verifikasi error Step 1 tidak terbawa ke Step 2/3 (uji alur manual: sebabkan error → lanjut step → banner hilang)
- [x] 3.3 Tambah state layar tunggu verifikasi di `usePublicOrder` (`handleRegisterNewStudent` tidak lagi membuat `selectedStudent`) dan verifikasi pendaftar baru terkunci total dengan pesan menunggu admin (tidak ada tombol ke Step 2)

## 4. Frontend — Database Siswa admin

- [x] 4.1 Bangun `StudentsView` + sub-komponen terpisah (`StudentTable`, `VerificationQueue` dengan badge jumlah pending, `StudentFormModal`) + `students-api.ts` + `useStudents.ts` mengikuti `design-taste-frontend` (label di atas input, radius konsisten, empty state, error inline); verifikasi tiap file ≤ 300 baris via `bun run check:file-size`
- [x] 4.2 Daftarkan tab "Database Siswa" di `App.tsx` (desktop + mobile) dengan branch isolation di UI dan verifikasi branch admin hanya melihat sekolahnya (uji manual 2 akun demo)

## 5. Kualitas, migrasi, dan rilis

- [x] 5.1 Sinkronkan skema (bila berubah): `bun run db:generate` + `db:push` lokal + eksekusi migrasi ke D1 remote + verifikasi `PRAGMA table_info`; verifikasi tabel/kolom sinkron sebelum commit
- [x] 5.2 Perbarui seed/demo bila ada skenario memakai siswa pending untuk order dan verifikasi `docs/DEMO_SCENARIO.md` tetap akurat
- [x] 5.3 Jalankan gate penuh berurutan dan verifikasi semuanya hijau: `type-check` (0 error), `lint`, `build`, `test`, `check:file-size`; lalu `openspec validate --change portal-order-fix-and-student-verification`
