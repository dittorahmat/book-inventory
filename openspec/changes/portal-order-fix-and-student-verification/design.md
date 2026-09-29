## Context

Lihat `proposal.md` (Why) dan `specs/*/spec.md` (kontrak perilaku). Keadaan kode saat ini yang membentuk pendekatan:

- `src/components/portal/portal-api.ts → readJson()` memanggil `res.json()` buta; semua endpoint portal (`fetchSchools`, `fetchPackages`, `submitFinalOrder`, dst.) memakai satu helper ini.
- `src/server/index.ts` tidak punya `app.onError()` — error tak terduga Hono dibalas plain-teks.
- `src/server/routes/public-orders.ts` memakai `Buffer.from()` di 3 titik (beasiswa:162, pembayaran:176, retur:298); `Buffer` tidak dijamin ada di Cloudflare Workers. Insert `orderPayments` (baris 183) terjadi SEBELUM `studentBookOrders` (baris 197).
- `students.status` enum: `active | promoted | new_pending | graduated` — belum ada `rejected`. `search-students` tanpa filter status, `POST /submit` tanpa cek status.
- `src/App.tsx` belum punya tab siswa; pola isolasi cabang yang ada (filter `schoolId` + proteksi per-route seperti di `studentOrdersRouter`) bisa dipakai ulang.
- Batasan repo (AGENTS.md): file `src/**` maks 300 baris, ID validasi `z.string().min(1)` (bukan uuid), tiap endpoint mutasi wajib test, migrasi D1 remote wajib sinkron, UI ikut `design-taste-frontend`.

## Goals / Non-Goals

**Goals:**

- Setiap kegagalan portal terbaca manusia dan selalu JSON; akar 500 (decoder + urutan insert) diperbaiki untuk reguler, beasiswa, dan retur publik sekaligus.
- Admin punya Database Siswa + antrian verifikasi; siswa baru terkunci total sampai approve.
- Semua perilaku di atas tercakup test regresi dan lolos gate kualitas repo.

**Non-Goals:**

- Notifikasi real-time/email ke admin saat ada pendaftar baru (cukup badge jumlah pending di tab; push/email follow-up terpisah).
- Perubahan skema pembayaran/beasiswa selain yang dibutuhkan keandalan submit.
- Migrasi data historis (tidak ada data pending lama yang perlu backfill khusus).

## Decisions

1. **Envelope error via `app.onError()` global di `src/server/index.ts`** — mengembalikan `{ success: false, message }` generik berbahasa Indonesia untuk 500, tanpa stack trace. Alternatif (try/catch per-route) ditolak: rapuh, mudah ada endpoint yang terlewat lagi.
2. **`readJson()` diperkuat, bukan diganti library** — cek `content-type` + `try/catch` di sekitar `res.json()`/`res.text()`, petakan ke pesan manusiawi per operasi (`fetchSchools`, `submitFinalOrder`, ...). Alternatif (interceptor HTTP global) ditolak: overkill untuk satu helper yang dipakai 7 call-site.
3. **Helper `decodeBase64ToBytes()` Worker-safe (atob → Uint8Array)** menggantikan ketiga `Buffer.from()` — satu fungsi dipakai beasiswa, pembayaran, dan retur. Alternatif (polyfill `Buffer` via unenv) ditolak: menambah dependency untuk 3 baris logika. Catatan: `atob` tersedia di Workers, Bun, dan Node 18+, jadi satu implementasi jalan di semua runtime repo ini.
4. **Urutan insert dibalik: order dulu, payment kemudian.** Jika insert payment gagal, order tetap ada berstatus `unpaid` (terlihat dan bisa direkonsiliasi admin) dan respons 500 JSON menjelaskan untuk coba lagi — dipilih atas alternatif hapus-order-otomatis yang menyembunyikan jejak kegagalan.
5. **Status `rejected` ditambah ke enum `students.status` (app-level, kolom tetap TEXT)** — SQLite tidak punya DDL enum sehingga tidak butuh migrasi kolom; bila ada kolom baru lain barulah `db:generate` + eksekusi ke D1 remote. Keputusan ini menjaga sinkronisasi D1 tetap aman.
6. **Router admin siswa baru (`src/server/routes/students.ts`, `/api/students`)** mengikuti pola `studentOrdersRouter`: list + filter + CRUD + aksi `POST /:id/verify { action: approve|reject, nis? }` (approve wajib NIS resmi). Proteksi mengikuti pola guard route yang sudah ada; branch isolation ditegakkan di query (bukan cuma di UI).
7. **UI admin dipecah sejak awal demi gate 300 baris**: `StudentsView.tsx` (wiring) + `src/components/students/StudentTable.tsx` + `VerificationQueue.tsx` + `StudentFormModal.tsx` + `students-api.ts` + hook `useStudents.ts`. Alternatif (satu file besar lalu pecah belakangan) ditolak: gate `check:file-size` akan gagal di tengah jalan.
8. **Layar tunggu sebagai state khusus** di `usePublicOrder` (mis. `verificationPending`), bukan step angka baru — agar breadcrumb 1-2-3 tidak berubah makna dan analytics step lama tetap valid. `handleRegisterNewStudent` mengeset state ini; tidak ada `selectedStudent` sampai approve.
9. **Filter status di query, bukan di memori**: `search-students` mengecualikan `new_pending`/`rejected` di klausa WHERE (butuh `and()` + kondisi status), dan `POST /submit` cek status setelah load student — pertahanan berlapis frontend + server.

## Risks / Trade-offs

- [Risk] Test `bun test` memakai runtime Bun (ada `Buffer`), sehingga test hijau TIDAK membuktikan aman di Workers → Mitigasi: helper decoder ditulis tanpa `Buffer` sama sekali + skenario submit-base64 diuji lewat helper secara langsung; idealnya satu kali verifikasi `wrangler dev`/`tail` sebelum rilis.
- [Risk] Base64 foto besar menekan limit request Worker → Mitigasi: batasi ukuran file di frontend sebelum upload (validasi size + kompresi ringan bila perlu) dan pesan error yang jelas bila 413.
- [Risk] `submit` 403 untuk pending dan `search` yang menyembunyikan pending mengubah perilaku API yang mungkin diandalkan demo lama → Mitigasi: ini perilaku yang diinginkan (disepakati user); skenario demo + seed diperbarui agar tidak ada demo yang memakai siswa pending untuk order.
- [Risk] NIS sementara `REG-xxxxxx` berbasis timestamp bisa tabrakan pada registrasi bersamaan → Mitigasi: tetap (risiko rendah, terdeteksi saat approve karena NIS resmi wajib unik); tidak masuk scope.
- [Trade-off] Order yatim (`unpaid` akibat payment gagal) menambah noise di daftar pesanan → diterima: jauh lebih baik daripada order hilang tanpa jejak; admin bisa hapus/batalkan manual.

## Migration Plan

1. Deploy backend dulu (envelope error + decoder + gate + router siswa), lalu frontend (helper portal + layar tunggu + tab siswa) — frontend lama tetap kompatibel karena respons sukses tidak berubah bentuk.
2. Jika ada perubahan skema: `bun run db:generate`, `bun run db:push` (lokal), eksekusi SQL ke D1 remote, verifikasi `PRAGMA table_info`, baru commit/push.
3. Rollback: revert ke build sebelumnya; tidak ada perubahan DDL destruktif (kolom TEXT, tambah nilai enum app-level), jadi rollback aman tanpa migrasi turun.

## Open Questions

- Apakah badge jumlah pending perlu tampil di header/tab admin, atau cukup angka di dalam halaman Database Siswa? (Deferrable: tidak mengubah spec, hanya penempatan UI — diusulkan di dalam halaman dulu.)
- Batas ukuran file lampiran yang ideal untuk jaringan sekolah (mis. 2 MB vs 5 MB)? (Deferrable: konstanta tunggal, bisa disetel saat implementasi.)
