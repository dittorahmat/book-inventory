# Coding & Workflow Conventions for Book Inventory

All agents and developers contributing to this codebase must adhere to the following quality checks and operational conventions.

---

## 1. Post-Modification Quality Checklist

After adding, modifying, or refactoring any feature, you **must** run and pass the following quality steps in sequence:

1. **Database Schema Synchronization & Remote Cloudflare D1 Migration (WAJIB)**
    - **Sinkronisasi Database Lokal**:
      ```bash
      bun run db:push
      # or drizzle-kit push
      # Bila drizzle-kit gagal dimuat (better-sqlite3 ERR_DLOPEN_FAILED),
      # pakai fallback bun:sqlite yang menerapkan file migrasi terbaru:
      bun run db:push:bun [./drizzle/<file-migrasi>.sql]
      ```
      Pastikan perubahan skema Drizzle (`src/db/schema.ts`) teraplikasikan ke database SQLite lokal (`data/inventory.db`).
   - **Migrasi Database Remote Cloudflare D1**:
     Setiap kali ada penambahan atau perubahan skema tabel/fitur baru, Anda **WAJIB** membuat dan menerapkan migrasi ke database remote Cloudflare D1 agar deployment Cloudflare Workers tidak mengalami error tabel hilang:
     ```bash
     bun run db:generate
     # Generate SQL migration file di direktori drizzle/
     
     # Terapkan langsung file SQL migrasi ke remote D1:
     bun x wrangler d1 execute book-inventory-db --remote --file=./<path-to-migration-file>.sql
     # atau jika menggunakan migrations folder:
     # bun run db:d1:migrate
     ```
     Verifikasi tabel dan kolom di database remote D1 telah sinkron sebelum commit dan push.
     Buktikan tanpa tebak: `bun run check:d1-drift` (membandingkan `drizzle/` vs remote, gagal bila ada tabel/kolom hilang) wajib hijau sebelum merge yang menyentuh skema. Karena gate itu butuh kredensial Cloudflare, sejak Okt 2026 ada **alarm otomatis harian yang setara** lewat Cron Trigger (`src/server/services/d1-drift-alert.ts` membandingkan `schema.ts` vs D1 live via binding, nol kredensial, sidik `d1_drift_alert_signature`) — gate manual tetap wajib, alarm hanya menutup celah "tidak ada yang menjalankannya".

2. **Type Safety Verification**
   ```bash
   npm run type-check
   # or bun run type-check
   ```
   Zero TypeScript errors (`tsc --noEmit`) are allowed.
   Modul service baru menerima `AppDatabase` (union bun-sqlite|D1) sehingga `select()` tak bertipe: anotasi callback dengan tipe baris `$inferSelect` + `Map<K, V>` eksplisit, contoh `src/server/services/internal-po.ts`.

3. **Code Linting & Formatting**
   ```bash
   npm run lint
   ```
   Fix any lint issues before committing or reporting completion.

4. **Production Build Check**
   ```bash
   npm run build
   ```
   Ensure both frontend assets (Vite) and backend server/worker bundles compile cleanly without bundling or unresolved module errors.

5. **Test Suite & Cloudflare Worker API Enforcement (WAJIB)**
   ```bash
   npm run test
   # or bun test
   ```
   **Requirement**: Setiap kali ada penambahan fitur atau modifikasi backend & API endpoints, Anda **WAJIB** mematuhi aturan pengujian dan kompatibilitas berikut:
   - **Kompatibilitas Validasi ID (Flexible Identifier Validation)**:
      - Jangan memaksakan `z.string().uuid()` pada identifier entity (seperti `schoolId`, `bookId`, `bookItemId`). Selalu gunakan `idSchema` dari `src/server/lib/validators.ts` (kanonik `z.string().min(1)`) agar kompatibel dengan data demo, slug kampus (contoh: `school-alw-1`), maupun format UUID v4 — ditegakkan oleh `bun run check:validators` dan CI; varian bermessage (pesan UX) dan field non-`*Id` dikecualikan.
     - Setiap endpoint mutasi (POST, PATCH, PUT) **wajib memiliki unit/integration test** yang memverifikasi payload dengan custom seeded string IDs maupun UUID.
   - **Sinkronisasi Skema Remote D1 vs Lokal**:
     - Setiap ada kolom atau tabel baru di `src/db/schema.ts`, migrasi remote D1 **wajib dieksekusi** dan diverifikasi (`PRAGMA table_info`) agar endpoint API di Cloudflare Worker tidak gagal dengan error SQLite `no such column` atau `no such table`.
   - **Error Handling & User Feedback Frontend (Anti Silent Failure)**:
     - Dilarang membuat fungsi frontend (`fetch`) tanpa blok `try/catch` atau tanpa penanganan blok `else` saat `response.ok` / `data.success` bernilai `false`.
     - User interface **wajib** menampilkan alert, toast, atau pesan error eksplisit yang mengekstrak `data.message` atau `data.error` dari server, sehingga tombol tidak "diam saja" saat API mengembalikan status 400/500.
     - Komponen input custom berlabel (`SearchableSingleSelect`/`SearchableMultiSelect`) mematikan validasi native `required`: setiap `required` di komponen ini **wajib** didampingi guard JS (cek kosong di submit/disabled tombol + pesan inline), dan `<label>` lama wajib dihapus saat migrasi (dilarang label ganda).
    - **Regression Test Updates**:
      - Setiap bug atau error API yang diperbaiki **wajib ditambahkan skenario test-nya** di berkas `src/server/routes/*.test.ts` untuk mencegah regresi di kemudian hari.
      - Setiap route di `src/server/routes/*.ts` **wajib punya pasangan** `*.test.ts` - ditegakkan oleh `bun run check:route-tests` dan CI (`.github/workflows/checks.yml`).
      - Test komponen UI meniru pola `src/components/portal/StudentSearchStep.test.tsx`: shim DOM `test-dom` terdekat + dynamic import `@testing-library/react` + `fireEvent` — paket `@testing-library/user-event` tidak terinstal, jangan diimpor.

6. **Frontend Aesthetics & Anti-Slop Check (`design-taste-frontend` Enforcement)**
   Setiap developer dan AI agent yang membuat atau memodifikasi UI/UX di codebase ini **WAJIB** mematuhi pedoman anti-slop dari skill `design-taste-frontend`:
   - **Brief Inference & Design Read**:
     - Perlakukan UI sebagai aplikasi logistik pendidikan B2B yang bersih, editorial, fungsional, dan ramah orang tua.
     - Dials Baseline: `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 5`.
   - **Anti-Default Discipline (Banned Patterns)**:
     - ❌ **Dilarang keras memakai AI-purple / blue glow gradient background** atau generic dark mesh. Gunakan neutral base (`Zinc` / `Slate` / `#F0F2F5`) dengan aksen solid berbobot (`#1877F2` dan Emerald untuk status beasiswa/sukses).
     - ❌ **Dilarang memakai pola Card-inside-Card-inside-Card** (template card bertumpuk di dalam card). Gunakan flat rows yang dipisahkan garis pembagi `divide-y divide-[#E4E6EB]`, soft border, atau whitespace hierarkis.
     - ❌ **Dilarang membulatkan sudut secara ekstrem dan tidak konsisten** (misal campuran acak `rounded-3xl` dengan `rounded-sm`). Kunci skala radius konsisten: `rounded-2xl` untuk container utama, `rounded-xl` untuk form card/input, dan `rounded-lg`/`rounded-xl` untuk tombol interaktif (*Shape Consistency Lock*).
     - ❌ **Dilarang membuat CTA label membungkus baris (CTA Button Wrap Ban)**. Label tombol harus ringkas (1–3 kata) dan tetap dalam satu baris di desktop.
   - **Tactile Feedback & Micro-Interactions**:
     - Setiap tombol aksi dan CTA wajib memiliki state `:active:scale-[0.98]` atau `:active:translate-y-[1px]` untuk menyimulasikan feedback fisik tombol nyata.
   - **Form & Typography Standards**:
     - Label input **wajib** selalu berada di atas kolom input (*Label ABOVE input*). Dilarang menjadikan placeholder sebagai label.
     - Pastikan kontras teks memenuhi standar aksesibilitas WCAG AA (minimal rasio 4.5:1 untuk teks normal). Dilarang teks abu-abu pudar di atas background abu-abu terang.
     - Terapkan full interactive UI states di setiap formulir: Loading spinner/skeleton, status kosong (*empty state*) yang edukatif, dan pesan error inline yang eksplisit.

7. **Code Maintainability & File-Size Gate (WAJIB)**
   - Setiap file sumber di `src/**/*.ts(x)` **WAJIB** maksimal **400 baris**. Jika file yang Anda ubah melebihi batas, Anda **WAJIB** memecahnya sebelum lapor selesai:
     - View besar → sub-komponen di `src/components/<fitur>/` + custom hook (`use<Fitur>`) + API layer (`<fitur>-api.ts`) + tipe bersama di `src/lib/<fitur>-types.ts`.
     - Route Hono besar → pindahkan logika bisnis ke `src/server/services/`, sisakan validasi + routing.
   - Pengecualian (tidak dihitung): `*.test.ts(x)`, `src/db/schema.ts`, `src/server/seed.ts`, `*.d.ts`.
   - Utang lama: file yang sudah >400 baris sebelum gate ini ada terdaftar di `GRANDFATHERED` dalam `scripts/check-file-size.ts` (daftar ini hanya boleh menyusut). File tersebut boleh disentuh untuk wiring kecil, tetapi kode fitur **BARU** wajib tinggal di file baru yang patuh batas — contoh: tombol/badge baru di view lama wajib jadi sub-komponen di `src/components/<fitur>/`, bukan JSX inline tambahan.
   - Verifikasi otomatis (gagal = belum boleh selesai):
     ```bash
     bun run check:file-size
     ```
     Gate ini memeriksa file yang diubah (git staged/unstaged/untracked di `src/`); `bun run check:file-size --all` memindai seluruh pohon `src/` dan itulah mode yang dipakai CI, karena pada checkout bersih (`git status` kosong) mode default akan lolos tanpa memeriksa satu file pun.

8. **YAGNI & One-Liner Discipline (WAJIB)**
   - **You Aren't Gonna Need It**: dilarang speculative generality. Factory/provider/class wrapper yang hanya dipakai sekali **wajib** jadi fungsi polos atau inline. Helper duplikat **wajib** dikanonikalisasi ke satu modul (`src/lib/transfer-pricing.ts` untuk rupiah/total, `src/lib/book-pricing.ts` (harga efektif, client-safe) + `src/server/services/pricing.ts` (harga sisi server), `src/lib/api.ts` untuk fetch, `DEFAULT_BREVO_API_URL` dari `email/types.ts`). Kode mati (nol pemanggil produksi) **wajib dihapus** beserta test-nya, bukan dikomentari — ditegakkan oleh `bun run check:dead` (export tanpa perujuk di file lain maupun signature modulnya sendiri), pre-commit, dan CI.
   - **Prefer one-liner solutions**: guard/loop verbose yang setara **wajib** jadi `map`/`filter`/`reduce`/`??`/`||`/ternary satu baris bila tidak mengubah perilaku (contoh: `pick` → `.find(...) ?? fallback`, `readSettingsMap` → `Object.fromEntries`, toggle → `toggleIn(setter)`, 5x `return` status → hitung `open`+`reason` + single return).
  - **Pengecualian D1 (lihat §10)**: panduan "N+1 `await insert` di loop → `Promise.all`" di atas **hanya berlaku untuk query BACA independen**. Untuk query TULIS (`insert`/`update`/`delete`) ke Cloudflare D1, `Promise.all` **dilarang** — wajib sekuensial atau satu `db.batch()` atomik.
   - **Aman**: refactor penyederhanaan dilarang mengubah perilaku — public API yang dipakai route/test (`selectProviderName`, `getSmtpConfig`, `sendEmailNotification`, `resolveScope`, `DashboardHttpError`) dipertahankan sebagai alias tipis bila perlu kompatibilitas.

---

## 9. Code Smell & Tech Debt Elimination (WAJIB)

1. **Pindai dulu, perbaiki dalam scope**: setiap sesi yang menyentuh `src/` **WAJIB** diawali pemindaian code smell read-only (`Grep` / `rg` / `Select-String`, tanpa edit) dan diakhiri eliminasi temuan sesuai scope yang disepakati user (quick wins / monolit / hardening).
2. **Katalog smell yang wajib dicek**:
   - File sumber >400 baris (§7, kecuali `*.test.ts`, `schema.ts`, `seed.ts`).
   - Helper duplikat: rupiah/total/pricing/fetch **wajib** memakai modul kanonik (§8: `lib/transfer-pricing.ts`, `lib/book-pricing.ts` (harga efektif, client-safe) + `server/services/pricing.ts` (harga sisi server), `lib/api.ts`); dilarang `function rupiah()` / `readJson()` lokal baru — ditegakkan oleh `bun run check:canonical-helpers` untuk helper yang sudah punya pemilik kanonik tunggal.
   - `any` baru, `@ts-ignore` / `eslint-disable` baru, `console.log` produksi.
   - `fetch` tanpa `try/catch` atau `.catch(()=>{})` diam tanpa toast (§5 anti silent failure).
   - `z.string().uuid()` (§5): gunakan `idSchema` dari `src/server/lib/validators.ts`.
   - Kode mati: hapus beserta test-nya — ditegakkan oleh `bun run check:dead`, bukan pemindaian manual.
3. **Aturan perbaikan**: kanonikalisasi ke modul yang sudah ada; satu perilaku per perubahan (dilarang mengubah perilaku saat refactor §8); setiap bug yang diperbaiki **wajib** disertai regression test di `src/server/routes/*.test.ts`.
4. **Dilarang menambah utang baru**: kode baru dengan `any`, helper duplikat, atau silent-catch = belum boleh lapor selesai. `any` ditegakkan oleh `bun run check:no-any`; salinan lokal helper yang sudah punya pemilik kanonik (`escapeHtml`, `formatRupiah`, `toIntRupiah`, `readJson`) oleh `bun run check:canonical-helpers` — keduanya memeriksa baris baru, bukan pemindaian manual.
5. **Verifikasi penutup** (setelah §1–§8, urutan sama dengan `.github/workflows/checks.yml`): `bun run type-check` (nol error) → `npm run lint` → `bun run check:file-size` → `bun run check:imports` → `bun run check:route-tests` → `bun run check:validators` → `bun run check:dead` → `bun run check:no-any` → `bun run check:canonical-helpers` → `bun run check:lanes` → `bun run check:plans` → `npm run build` → `bun test`. Seluruh urutan itu dijalankan satu perintah lokal: `bun run check:all`. Tiga gate diff-scoped (`check:file-size`, `check:no-any`, `check:canonical-helpers`) kini tidak lagi vakum di CI: ia mendiff terhadap base ref PR (`GATE_BASE_REF`, dan `--all` untuk file-size), bukan terhadap working tree yang bersih saat `actions/checkout`.

---

## 2. Technology Stack Standards

- **Runtime & Package Manager**: [Bun](https://bun.sh/) (or Node.js fallback where applicable).
- **Shell**: PowerShell 7+ (`pwsh`) di Windows — tanpa `head`/`awk`/`wc`/`printf`/`cat`/`grep`/`tail`/`rm`; `mkdir` hanya satu direktori per perintah (multi-dir gagal — pakai `New-Item -ItemType Directory -Force` per direktori); hapus file via `Remove-Item`; glob (`*.sql`) tidak mengembang di argumen skrip npm/bun — tulis path eksplisit; tulis skrip sekali-pakai via tool `Write` lalu `bun <file>` daripada `bun -e` dengan kutip bersarang, dan potong/hitung/lihat/cari output via `Select-String`/`Select-Object`/`Measure-Object`/`Get-Content` (atau tool `Grep`/`Read`, jangan `grep` shell — bukan cmdlet pwsh dan langsung gagal).
- **Backend**: [Hono](https://hono.dev/) with TypeScript.
- **ORM & Database**: [Drizzle ORM](https://orm.drizzle.team/) with SQLite core.
  - Initial deployment: Cloudflare D1.
  - Production transition: Bun native SQLite / standalone SQLite file.
- **Frontend**: React, Vite, TypeScript.
- **File / Cover Storage**: Cloudflare R2 / S3-compatible storage abstraction.

---

## 3. Architecture & Domain Rules

1. **Physical Unit Tracking**: Books are tracked at the physical copy level (`book_items`) with unique barcode/asset tags, physical condition, and current school assignment.
2. **Branch Isolation**: School branch administrators must only access and manage inventory assigned to their school (`current_school_id = branch_id`).
3. **Inter-school Transfers**: Books moved between HQ and branches must transition through formal transfer shipments with status tracking (`draft` -> `pending_dispatch` -> `in_transit` -> `completed` / `discrepancy`).

---

## 4. Agent Delegation Fallback (Anti-Delay Rule)

1. **Satu kali retry, lalu kerjakan sendiri**: Jika delegasi ke subagent gagal (model tidak tersedia, error infrastruktur, timeout berulang), AI agent hanya boleh mencoba ulang **maksimal 1x**. Setelah itu **WAJIB** langsung mengimplementasikan sendiri (direct implementation) tanpa menunggu delegasi pulih.
2. **Dilarang membiarkan user menunggu**: Kegagalan infrastruktur delegasi bukan alasan untuk menunda pekerjaan. Jelaskan penyebabnya dalam 1 kalimat, lalu mulai kerja.
3. Aturan ini berlaku untuk semua sesi dan semua fitur di codebase ini.
4. **Default tetap sekuensial (satu tiket per commit)**: di repo ini eksekusi spec default berjalan sekuensial langsung di satu integration branch. Subagent implementer paralel kini **diizinkan tanpa izin user per-sesi** bila seluruh syarat §4.5 terpenuhi **dan** lane manifest (§4.5) dideklarasikan; tanpa manifest, default tetap sekuensial.
5. **Pola paralel yang TERBUKTI aman (Okt 2026, fitur verifikasi bukti bayar)**: fan-out boleh dilakukan sebagai **lane file-disjoint di SATU working tree yang sama** — bukan worktree terpisah. Worktree terpisah tetap **DILARANG**: biaya `bun install` per worktree + merge antar-branch adalah penyebab kegagalan terdokumentasi (Okt 2026: 5 delegasi interrupted + cleanup worktree timeout). Syarat wajib pola ini:
   - **Bekukan kontrak lebih dulu** (payload endpoint, nama field, tipe baris) sebelum lane jalan; lane UI boleh dibangun terhadap endpoint yang belum ada di backend.
   - **Deklarasikan lane manifest** `docs/agents/lanes.json` (gitignored, transient, per-sesi) dengan skema `{ base?: string, lanes: [{ id: string, files: string[] }] }`; format contoh dilacak di `docs/agents/lanes.example.json`. `base` (opsional) menambahkan diff `<base>...HEAD` ke himpunan file yang diperiksa. Union seluruh allowlist lane **wajib mencakup SETIAP file yang berubah**, ditegakkan oleh `bun run check:lanes` (berjalan di dalam `check:all`, CI, dan pre-commit; self-skip saat manifest tidak ada).
   - **Setiap file milik tepat satu lane** — tulis allowlist file per lane; file bersama (mis. `schema.ts`, `public-orders.ts`, `settings*.ts`, `drizzle/**`) dialokasikan ke satu lane saja dan lane lain dilarang menyentuhnya. Skema + migrasi D1 dikerjakan agent utama secara serial sebelum lane berjalan.
   - **Lane dilarang `git add`/`commit`/`checkout`** dan dilarang menjalankan `lint`/`build`/`bun test` penuh — hanya `bun test <file-target>`. `bun run type-check` **boleh** dijalankan (read-only) dengan aturan ketat: perbaiki HANYA error di file milik lane itu, error di file lane lain **laporkan** ke agent utama dan jangan disentuh. Commit dan seluruh gate repo-wide dijalankan **serial oleh agent utama** setelah semua lane berhenti.
   - **Lane wajib melaporkan kontrak yang kurang/penyimpangan** ke agent utama, bukan menebak.
   - Setelah integrasi, agent utama **WAJIB** menjalankan urutan gate §9.5 penuh. Celah verifikasi yang berulang: `select()` pada union `AppDatabase` menghasilkan baris `any` sehingga callback `.map/.filter` gagal `tsc` (§2) — inilah alasan lane kini **diizinkan** menjalankan `type-check` read-only.
   - Bukti pola ini berhasil: 3 lane (backend inti / kanal WhatsApp / UI) menyentuh ~30 file tanpa satu pun konflik tulis, tanpa merge, dan tanpa instalasi dependensi ulang; 15 error type-check tersisa ditutup di fase integrasi.
6. Pengecualian: refactor cross-cutting yang menyentuh file bersama (hunk overlap antar kandidat) boleh satu commit mencakup semua kandidat agar tiap commit tetap buildable.
7. **Pantau CI/PR dengan cek singkat berinterval**: jangan satu polling panjang yang memblokir (Okt 2026: loop 10×30 dtk diabort user 2×) — satu `gh pr checks` cepat per beberapa menit sampai hijau.

---

## 5. Bun Version & Lockfile Discipline (Anti-Build-Failure Rule)

1. Cloudflare build memakai **bun@1.2.15** (lihat field `packageManager` di `package.json`) dengan `bun install --frozen-lockfile`.
2. **DILARANG** commit `bun.lock` yang ditulis oleh bun versi lebih baru — format lockfile v2 tidak dikenal oleh bun 1.2.15 sehingga build gagal dengan error `Unknown lockfile version`.
3. Setiap perintah yang mengubah lockfile (`bun add` / `remove` / `install`) **WAJIB** dijalankan dengan bun yang sama seperti `packageManager`:
   ```bash
   npx -y bun@1.2.15 install
   ```
   Verifikasi `lockfileVersion` di `bun.lock` tetap format lama sebelum commit dan push.
4. Jangan upgrade `packageManager`/versi bun tanpa memastikan Cloudflare mendukung versi tersebut.

---

## 6. Test Database Isolation & Production D1 Write Discipline (Anti-Pollution Rule)

1. `bun test` **WAJIB** berjalan di database sementara terisolasi, bukan `data/inventory.db`:
   - Mekanisme: `test/setup.ts` (dimuat via `[test] preload` di `bunfig.toml`) membuat `data/.tmp-test-<pid>.db`, menerapkan seluruh migrasi `drizzle/00*.sql`, mengarahkan `DB_PATH` ke sana, lalu menjalankan baseline seed — semua sebelum file test mana pun diimpor.
   - **DILARANG** menonaktifkan/mengubah preload ini tanpa pengganti yang setara. **DILARANG** mengarahkan test ke D1 (remote maupun lokal): tidak ada file `*.test.ts` yang boleh menerima binding D1/`env.DB`; akses DB test hanya via proxy `src/db`.
   - Test baru **wajib mandiri**: seed data yang dibutuhkan sendiri dengan ID unik (stempel waktu) dan bersihkan setelah selesai (`finally`/`cleanup`), agar run berulang tidak menumpuk baris.
   - Verifikasi isolasi: setelah `bun test`, `data/inventory.db` tidak boleh berubah (cek jumlah baris tabel utama sebelum vs sesudah).
2. **Disiplin tulis ke D1 production** (mencegah insiden 180 sekolah sampah berisi data test):
   - **DILARANG** QA manual / skrip / test ke API production (`*.workers.dev`) yang membuat data bernama `*Test*`, `Sekolah school-*`, `SUP-WF-*`, dan pola sampah sejenis. QA destruktif hanya di dev lokal.
   - Sidik pola-uji kanonik: `isTestSeedValue` di `src/server/lib/validators.ts` (satu-satunya sumber kebenaran pola). `scripts/export-d1-seed.ts` **fail-closed** (exit 1 bila DB lokal mengandung baris pola-uji — vektor insiden Okt 2026: `WHERE id LIKE 'school-%'` ikut mengekspor sampah); alarm remote read-only `bun run check:d1-junk` dijalankan manual pre-merge seperti `check:d1-drift`. Sejak Okt 2026 ada pula **alarm otomatis harian** (Cron Trigger `[triggers]` → handler `scheduled` di `src/server/worker.ts` → `src/server/services/d1-junk-alert.ts`, 17:00 UTC / 00:00 WIB) yang memindai lewat binding D1 tanpa kredensial tambahan dan mengirim email ke seluruh `central_admin` **hanya saat himpunan sampah berubah** (sidik di `system_settings` kunci `d1_junk_alert_signature`), sehingga kebocoran tidak lagi menunggu pre-merge berikutnya. Cron yang sama juga menjalankan alarm drift skema (`d1-drift-alert.ts`, kunci `d1_drift_alert_signature`); keduanya memakai inti bersama `d1-alarm.ts` (sidik + anti-spam + pengiriman email) agar tidak ada dua implementasi paralel (§8).
   - Setiap `wrangler d1 execute ... --remote` yang bersifat tulis (terutama `DELETE` massal) **WAJIB** didahului: (a) verifikasi target (`database_name`/`database_id`), (b) `SELECT COUNT(*)` + contoh baris dengan predikat yang sama, (c) cek nol relasi anak di semua tabel yang mereferensikan (`students`, `student_book_orders`, `book_items`, `package_items`, `transfer_shipments`, `purchase_orders`, `users` untuk tabel `schools`).

---

## 10. Cloudflare D1 & Workers Write Discipline (Anti-500 Rule)

Latar insiden (Okt 2026): terima inbound 30 eks dan buat transfer 7 unit mengembalikan 500 di production padahal test lokal hijau. Forensik D1 menunjukkan baris induk tertulis tetapi baris anak tidak — bulk insert dan insert konkuren gagal di D1. Batas ini adalah sifat D1 secara umum (bukan khusus free tier): SQLite lokal (bun-sqlite) jauh lebih permisif sehingga **test hijau lokal bukan bukti aman di D1**.

1. **Chunked multi-row insert (WAJIB)**: satu statement `INSERT ... VALUES` **dilarang** melebihi **10 baris** sekaligus (batas bound-parameter D1). Wajib di-chunk (maks 10 baris/statement), dieksekusi sekuensial.
2. **Dilarang `Promise.all` untuk tulis**: query TULIS (`insert`/`update`/`delete`) ke D1 **wajib** sekuensial atau satu `db.batch()` atomik. `Promise.all` hanya boleh untuk query BACA independen (lihat pengecualian §8).
3. **Atomisitas multi-tulis (WAJIB)**: setiap alur yang menulis induk + anak (PO → `book_items`, shipment → item lines) wajib atomik — gunakan `db.batch()` saat runtime D1 dengan fallback sekuensial di bun-sqlite — atau idempoten dengan validasi pra-tulis yang mengembalikan 400, bukan 500.
4. **Pemetaan error D1 (WAJIB)**: error mentah D1 (`D1_ERROR`, `UNIQUE constraint`, `FOREIGN KEY constraint`) **wajib dipetakan** ke respons 4xx berpesan jelas. Dilarang membiarkan jatuh ke `onError` 500 generik.
5. **Uji volume produksi (WAJIB)**: setiap endpoint tulis bervolume wajib diuji pada volume produksi (minimal 30 baris sekaligus) di `src/server/routes/*.test.ts`. Chunking membuat test yang sama lolos di kedua runtime.

---

## 11. Search Discipline (Anti Full-Scan Rule)

Latar (2026): `search-students` portal global tanpa `schoolId`, `GET /students` dan `GET /student-orders` `SELECT`-all lalu `.filter(includes)` di JS — full-scan + transfer seluruh tabel ke Worker. Target: 10rb murid, p95 <500ms di D1.

1. **Dilarang `SELECT`-all + filter JS**: filter search **wajib** di `WHERE` SQL, bukan `.filter()` / `.includes()` pasca-fetch. Pengecualian: katalog kecil (<2rb baris, mis. `books`, `packages`) boleh filter frontend.
2. **Substring `%q%` wajib terpartisi untuk endpoint publik**: portal (`search-students`, `lookup-order`) **wajib** didahului `school_id = ?` (API menolak pencarian tanpa sekolah). Endpoint admin/staf sentral boleh global tanpa `schoolId`, tetapi wajib `WHERE` di SQL + `LIMIT` 50 — tetap dilarang `SELECT`-all + filter JS dan dilarang tanpa `LIMIT`.
3. **Setiap endpoint `search` wajib berpasangan**: (a) satu filter partisi (`schoolId`), (b) `LIMIT` 10–50, (c) indeks komposit di `schema.ts` via `index()` Drizzle + migrasi remote terverifikasi (`PRAGMA index_list`). Pasangan per form: portal murid → sekolah+status verified; lookup-order → sekolah opsional+min 3 char; admin siswa → sekolah+status; pesanan → sekolah+payment+fulfillment; retur → sekolah+status retur; katalog → kategori (bila >2rb).
4. **FTS5 Tahap 2 saja**: FTS (virtual table + trigger) hanya atas bukti `EXPLAIN QUERY PLAN` masih `SCAN` dan p95 >500ms setelah Tahap 1, untuk pencarian global lintas-sekolah. Query FTS wajib token-prefix (`salsa*` menjangkau "Annisa Salsabila"), bukan `%...%`.
5. **Bukti wajib**: setiap endpoint search baru/ubah wajib lampirkan `EXPLAIN QUERY PLAN` (`SEARCH USING INDEX`, bukan `SCAN`) + test volume di `src/server/routes/*.test.ts` — ditegakkan oleh `bun run check:plans`, pre-commit, dan CI. Gate itu juga **mengaudit sumbernya**: file yang memakai `matchLower`/`matchAnyLower` atau membangun pola `%${...}%` wajib terdaftar di `REGISTERED_SEARCH_SOURCES` — endpoint pencarian baru di file baru langsung **merah** sampai bukti plan-nya ditambahkan, sehingga daftar query tidak bisa lagi tertinggal dari kode.

---

## 12. Edit Anchor Discipline (Anti-Misplaced-Edit Rule)

Latar (Okt 2026): `oldString: "});"` yang cocok di banyak tempat menimpa lokasi pertama dan mematahkan `sales-report.test.ts` — 3 putaran perbaikan untuk satu edit. Varian prefix: `replaceAll "../../db"` menimpa hasil `"../../../db/schema"` menjadi `"../../../../db/schema"` — prefix pendek cocok di dalam hasil prefix panjang.

1. **Jangkar edit wajib unik berkonteks**: setiap `oldString` minimal 3 baris mencakup pengenal unik (nama fungsi, string literal khas, atau komentar di sekitarnya) sehingga hanya cocok di satu lokasi.
2. **Dilarang jangkar generik satu baris** (`});`, `}`, `return ...`, baris kosong) sebagai `oldString` — perluas dengan konteks lebih luas bila tool menolak karena multi-match, jangan persempit hingga generik.
3. Reviewer: jangkar satu baris di diff tool-call adalah red flag.
4. **Quoted-prefix untuk `replaceAll` path bertingkat**: sertakan kutip penutup dalam `oldString` (`"../../db"` dengan kutip, bukan `../../db` telanjang) agar prefix pendek tak cocok di dalam hasil prefix panjang; ganti path terpanjang dulu. Ditegakkan oleh `bun run check:imports` (gagal bila import keluar `src/` atau target tak ada), pre-commit, dan CI.

---

## Agent skills

### Issue tracker

GitHub Issues via `gh` CLI (`dittorahmat/book-inventory`). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` and `docs/adr/`). See `docs/agents/domain.md`.

### Location & auth pointer

Lokasi transaksi aktif dikunci ke penugasan akun di `src/App.tsx`; header hanya badge tampilan (`src/components/layout/AppHeader.tsx`); scope server di `src/server/services/access-scope.ts`. Mulai dari tiga titik ini dulu — grep luas tenggelam di mirror skill (`.agents/`, `.claude/`, `.gemini/`, `.opencode/`). Modul layanan ber-seam tinggal di direktori (`services/return/index.ts`), bukan file datar — bila `<nama>.ts` tak ada, coba `<nama>/index.ts` dulu sebelum grep luas.

