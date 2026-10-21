# Coding & Workflow Conventions for Book Inventory

All agents and developers contributing to this codebase must adhere to the following quality checks and operational conventions.

---

## 1. Post-Modification Quality Checklist

After adding, modifying, or refactoring any feature, you **must** run and pass the following quality steps in sequence:

1. **Database Schema Synchronization & Remote Cloudflare D1 Migration (WAJIB)**
    - **Sinkronisasi Database Lokal**:
      ```bash
      bun run db:push          # bun:sqlite — jalur utama, idempoten, menerapkan migrasi tertunda
      bun run db:push --all    # terapkan semua migrasi tertunda (mis. DB lokal baru)
      bun run db:push:drizzle  # drizzle-kit push (better-sqlite3; gagal ERR_DLOPEN_FAILED di sebagian mesin)
      bun run db:query "SELECT COUNT(*) AS c FROM students"   # baca-saja, verifikasi data
      ```
      Pastikan perubahan skema Drizzle (`src/db/schema.ts`) teraplikasikan ke `data/inventory.db`. Untuk memeriksa data nyata (duplikat, volume, sampel baris) pakai `db:query` yang baca-saja alih-alih menulis skrip sekali-pakai.
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
     Verifikasi tabel dan kolom di database remote D1 telah sinkron sebelum commit dan push. Pembacaan remote juga boleh baca-saja lewat CLI: `bun x wrangler d1 execute book-inventory-db --remote --command "PRAGMA index_list('students')"`.
     Buktikan tanpa tebak: `bun run check:d1-drift` (membandingkan `drizzle/` vs remote, gagal bila ada tabel/kolom hilang) wajib hijau sebelum merge yang menyentuh skema. Karena gate itu butuh kredensial Cloudflare, sejak Okt 2026 ada **alarm otomatis harian yang setara** lewat Cron Trigger (`src/server/services/d1-drift-alert.ts` membandingkan `schema.ts` vs D1 live via binding, nol kredensial, sidik `d1_drift_alert_signature`) — gate manual tetap wajib, alarm hanya menutup celah "tidak ada yang menjalankannya".
   - **Pengecualian destruktif — DROP wajib SETELAH deploy, bukan sebelum merge (ADR-0013)**:
     Aturan di atas berlaku untuk migrasi **aditif** (tambah tabel/kolom/index). Migrasi **destruktif** (`DROP TABLE`, `DROP COLUMN`, atau mengubah kolom sehingga kode lama tak lagi cocok) **DILARANG** diterapkan ke remote D1 sebelum PR-nya merge **dan** ter-deploy, karena kode dan skema tidak dideploy bersama: Worker produksi masih meng-query objek yang sudah hilang. Urutannya dua PR — (1) kode berhenti memakai objek itu, merge, deploy; (2) PR terpisah men-drop objeknya. Sebut perubahan destruktif di deskripsi PR. Kalau kadung tidak sinkron (skema sudah maju, kode produksi tertinggal), perbaikannya adalah **deploy kode**, bukan rollback skema — lihat insiden 18 Okt 2026 di ADR-0013. `check:d1-drift` tidak menangkap kelas cacat ini: ia hanya melihat objek yang hilang dari remote, bukan kode produksi yang tertinggal.

2. **Type Safety Verification** — `bun run type-check` (satu langkah di `check:all`, §9.5): nol error `tsc --noEmit`.
   Yang tak bisa ditebak mesin: `AppDatabase` schema-aware (`BaseSQLiteDatabase<"sync" | "async", unknown, typeof schema>` di `src/db/index.ts`) membuat `select()`/`insert()` mengembalikan baris terketik, sehingga anotasi callback `$inferSelect` manual **tidak lagi perlu** dan justru keliru pada hasil JOIN — biarkan inferensi. Dilarang menutup celah tipe DB dengan `any`/cast baru; perbaiki tipe sumbernya (mis. `PaymentDerivation` di `src/server/services/order-intake/validation.ts`), ditegakkan `check:no-any`.

3. **Code Linting & Formatting** — `bun run lint` (langkah di `check:all`).

4. **Production Build Check** — `bun run build` (langkah di `check:all`): aset Vite + bundel server/worker wajib kompilasi bersih tanpa modul tak terselesaikan.

5. **Test Suite & Cloudflare Worker API Enforcement (WAJIB)** — `bun test` (langkah di `check:all`).
   - **Validasi ID**: jangan `z.string().uuid()` pada identifier entity (`schoolId`, `bookId`, …); pakai `idSchema` dari `src/server/lib/validators.ts` (kanonik `z.string().min(1)`) agar kompatibel dengan slug demo (`school-alw-1`) maupun UUID v4 — ditegakkan `check:validators`. Setiap endpoint mutasi wajib punya test dengan ID string seeded maupun UUID.
   - **Sinkronisasi skema remote D1**: setiap kolom/tabel baru wajib dimigrasikan ke D1 remote (§1.1) dan diverifikasi, agar Worker tidak gagal `no such column`/`no such table`.
   - **Anti silent failure (frontend — tidak digerbang)**: dilarang `fetch` tanpa `try/catch` atau tanpa cabang `else` saat `response.ok`/`data.success` bernilai `false`; UI wajib menampilkan alert/toast/pesan eksplisit yang mengekstrak `data.message`/`data.error`, agar tombol tidak "diam saja" pada 400/500.
   - **Select custom** (`SearchableSingleSelect`/`SearchableMultiSelect`) mematikan validasi native `required`: setiap `required` wajib didampingi guard JS (cek kosong saat submit/disabled + pesan inline), dan `<label>` lama wajib dihapus saat migrasi (dilarang label ganda).
   - **Test**: setiap bug API yang diperbaiki wajib menambah skenario di `src/server/routes/*.test.ts`; setiap route wajib berpasangan `*.test.ts` (ditegakkan `check:route-tests`). Test komponen UI meniru `src/components/portal/StudentSearchStep.test.tsx` (shim DOM `test-dom` + dynamic import `@testing-library/react` + `fireEvent`); `@testing-library/user-event` tidak terinstal.

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
   - Verifikasi: `check:file-size` (langkah di `check:all`) — mode default hanya memeriksa file yang diubah dan vakum pada checkout bersih (`git status` kosong); `--all` memindai seluruh pohon `src/` dan itulah mode CI.

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
   - Helper & tipe duplikat: rupiah/total/pricing/fetch/tipe kanonik **wajib** memakai modul kanonik (§8: `lib/transfer-pricing.ts`, `lib/book-pricing.ts` (harga efektif, client-safe) + `server/services/pricing.ts` (harga sisi server), `lib/api.ts`, `lib/staff-roles.ts` untuk routing/badge/predikat staf, `components/layout/AppTabsNavigation.tsx` untuk `ActiveTab`); dilarang `function rupiah()` / `readJson()` / deklarasi ulang `type ActiveTab` lokal baru — ditegakkan oleh `bun run check:canonical-helpers` untuk helper dan tipe yang sudah punya pemilik kanonik tunggal.
   - `any` baru, `@ts-ignore` / `eslint-disable` baru, `console.log` produksi.
   - `fetch` tanpa `try/catch` atau `.catch(()=>{})` diam tanpa toast (§5 anti silent failure).
   - `z.string().uuid()` (§5): gunakan `idSchema` dari `src/server/lib/validators.ts`.
   - Kode mati: hapus beserta test-nya — ditegakkan oleh `bun run check:dead`, bukan pemindaian manual.
   - Zero UI Layout Redesign without Spec Mandate: dilarang merombak layout/struktur kontainer UI (misal grid ke scrollable flex) kecuali secara eksplisit disyaratkan dalam spec/design proposal.
   - Nomor dokumen dibangkitkan `documentNumber()` tetapi kolom targetnya tanpa UNIQUE (duplikat senyap) — ditegakkan `check:doc-numbers`.
   - Berkas yang menulis lewat `runWriteBatch()` tanpa `d1WriteErrorStatus()` (constraint D1 naik jadi 500) — ditegakkan `check:d1-error-mapping`.
   - Kolom ber-partisi (`…schoolId`) tanpa indeks pendahulu — read list `WHERE school_id = ?` jadi `SCAN` saat volume naik — ditegakkan `check:plans` (kelengkapan).
   - Baca daftar tak-terbatas pada route tabel ber-partisi (endpoint tumbuh tanpa `LIMIT`) — ditegakkan `check:plans` (batas baca).
3. **Aturan perbaikan**: kanonikalisasi ke modul yang sudah ada; satu perilaku per perubahan (dilarang mengubah perilaku saat refactor §8); setiap bug yang diperbaiki **wajib** disertai regression test di `src/server/routes/*.test.ts`.
4. **Dilarang menambah utang baru**: kode baru dengan `any`, helper duplikat, atau silent-catch = belum boleh lapor selesai. `any` ditegakkan oleh `bun run check:no-any`; salinan lokal helper/tipe yang sudah punya pemilik kanonik (`escapeHtml`, `formatRupiah`, `toIntRupiah`, `readJson`, `isoTimeFragment`, `epochTimeFragment`, `documentNumber`, `randomSerial`, `getDefaultTabForRole`, `getRoleBadgeLabel`, `getVisibleTabsForRole`, `ActiveTab`, `StaffRole`) oleh `bun run check:canonical-helpers` — keduanya memeriksa baris baru, bukan pemindaian manual.
5. **Verifikasi penutup**: `bun run check:all` menjalankan seluruh gate berurutan — daftar dan urutannya adalah field `check:all` di `package.json` (CI memakai urutan yang sama di `.github/workflows/checks.yml`), jadi jangan disalin ke sini. Yang perlu diketahui: tiga gate diff-scoped (`check:file-size`, `check:no-any`, `check:canonical-helpers`) tidak vakum di CI karena mendiff base ref PR (`GATE_BASE_REF`; `--all` untuk file-size), sedangkan sisanya memindai seluruh pohon.

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
4. **Staff Roles & Navigation Boundaries**: Pemetaan wewenang role staf dan routing tab navigasi diatur secara kanonik:
   - Backend access scope & role checking: `src/server/services/access-scope.ts` (`STAFF_ROLES`, `LOGISTICS_ROLES`, `resolveRequestActor`).
   - Frontend staff predicates, routing tab default, & badge labels: `src/lib/staff-roles.ts` (`getDefaultTabForRole`, `getRoleBadgeLabel`, `isCentralRole`, `isLogisticsRole`, `isUniformStaffRole`, `isBookWarehouseStaffRole`, `isSchoolRole`).
   - Navigasi tab & desktop/mobile visibility: `src/components/layout/AppTabsNavigation.tsx` (`TAB_IDS`, `ActiveTab`, `getVisibleTabsForRole`, `AppTabsNavigation`, `AppMobileNavigation`).
   - Dilarang membuat routing tab ad-hoc di luar helper kanonik ini.

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
   - Setelah integrasi, agent utama **WAJIB** menjalankan urutan gate §9.5 penuh. Celah verifikasi yang berulang: perubahan tipe bersama (mis. seam `AppDatabase` di `src/db/index.ts`) memunculkan error `tsc` di banyak file lintas-lane sekaligus, sehingga lane **diizinkan** menjalankan `type-check` read-only — perbaiki hanya file milik lane itu, laporkan sisanya ke agent utama.
   - Bukti pola ini berhasil: 3 lane (backend inti / kanal WhatsApp / UI) menyentuh ~30 file tanpa satu pun konflik tulis, tanpa merge, dan tanpa instalasi dependensi ulang; 15 error type-check tersisa ditutup di fase integrasi.
6. Pengecualian: refactor cross-cutting yang menyentuh file bersama (hunk overlap antar kandidat) boleh satu commit mencakup semua kandidat agar tiap commit tetap buildable.
7. **Pantau CI/PR dengan cek singkat berinterval**: jangan satu polling panjang yang memblokir (Okt 2026: loop 10×30 dtk diabort user 2×) — satu `gh pr checks` cepat per beberapa menit sampai hijau.
8. **Dilarang commit langsung ke `main`/`master`**: pekerjaan mendarat lewat branch + PR. Ditegakkan **branch guard** di `scripts/githooks/pre-commit` (aktif via `core.hooksPath = scripts/githooks`): commit di `main` ditolak dengan pesan yang menyebut cara membuat branch; paksa bila memang disengaja lewat `ALLOW_MAIN_COMMIT=1 git commit ...`. Rebase/merge/cherry-pick yang sedang berjalan dilewati agar penyelesaian konflik tidak terhalang. Alasan: seluruh gate memeriksa **isi** commit, tak satu pun memeriksa **tujuannya** — insiden Okt 2026: dua commit nyasar ke `main` dan baru ketahuan saat akan didorong.

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
   - **DILARANG** menonaktifkan/mengubah preload ini tanpa pengganti yang setara. **DILARANG** mengarahkan test ke D1 (remote maupun lokal): tidak ada file `*.test.ts` yang boleh menerima binding D1/`env.DB`; akses DB test hanya via proxy `src/db`. Ditegakkan oleh `bun run check:test-isolation` (statis, bukan disiplin): gate menolak setiap referensi binding D1 (`env.DB`, `D1Database`, `@cloudflare/workers-types`, `Miniflare`, `getPlatformProxy`, `wrangler`) di file test, serta gagal bila preload `test/setup.ts` hilang dari `bunfig.toml` atau `test/setup.ts` tak lagi menyetel `process.env.DB_PATH`.
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
4. **Pemetaan error D1 (WAJIB)**: error **constraint** (`UNIQUE constraint`, `FOREIGN KEY constraint`) **wajib dipetakan** ke respons 4xx berpesan jelas lewat `d1WriteErrorStatus()` di `src/server/lib/d1-write.ts` — dilarang membiarkannya jatuh ke `onError` 500 generik. Sebaliknya kegagalan infra (`D1_ERROR`) **tidak** boleh dipetakan ke 4xx: helper mengembalikan `null` dan pemanggil **wajib melempar ulang** agar tercatat sebagai 500 + ref, bukan ditelan jadi 400 yang menyamarkan bug. Ditegakkan `check:d1-error-mapping`.
5. **Uji volume produksi (WAJIB)**: setiap endpoint tulis bervolume wajib diuji pada volume produksi (minimal 30 baris sekaligus) di `src/server/routes/*.test.ts`. Chunking membuat test yang sama lolos di kedua runtime.
6. **Gate statis**: `check:d1-writes` menegakkan §10.1 dan §10.2 di seluruh `src/**` kecuali `*.test.ts` (bagian dari `check:all`, pre-commit, dan CI). False-negative yang disadari: `.values(chunk)` variabel, tulis di balik helper opaque, dan isi `db.batch([...])` — pengecualian resmi lewat `REGISTERED_EXCEPTIONS` di skrip gate (pola `REGISTERED_SEARCH_SOURCES`). §10.3–§10.5 tetap tanggung jawab reviewer.

---

## 11. Search Discipline (Anti Full-Scan Rule)

Latar (2026): `search-students` portal global tanpa `schoolId`, `GET /students` dan `GET /student-orders` `SELECT`-all lalu `.filter(includes)` di JS — full-scan + transfer seluruh tabel ke Worker. Target: 10rb murid, p95 <500ms di D1.

1. **Dilarang `SELECT`-all + filter JS**: filter search **wajib** di `WHERE` SQL, bukan `.filter()` / `.includes()` pasca-fetch. Pengecualian: katalog kecil (<2rb baris, mis. `books`, `packages`) boleh filter frontend.
2. **Substring `%q%` wajib terpartisi untuk endpoint publik**: portal (`search-students`, `lookup-order`) **wajib** didahului `school_id = ?` (API menolak pencarian tanpa sekolah). Endpoint admin/staf sentral boleh global tanpa `schoolId`, tetapi wajib `WHERE` di SQL + `LIMIT` 50 — tetap dilarang `SELECT`-all + filter JS dan dilarang tanpa `LIMIT`. Batas baca ini ditegakkan `check:plans`: setiap baca tabel ber-partisi di `src/server/routes/` wajib `.limit()` — kecuali baca baris tunggal lewat kunci primer/kolom UNIK; pengecualian di `REGISTERED_UNBOUNDED_READS` beserta alasan. Cakupannya sengaja hanya route: pemanggil service sudah membatasi masukannya (`inArray` dari kueri terbatas, baca per kunci, agregasi laporan) — memeriksa service melahirkan ~30 positif palsu dari 40 temuan.
3. **Setiap endpoint `search` wajib berpasangan**: (a) satu filter partisi (`schoolId`), (b) `LIMIT` 10–50, (c) indeks komposit di `schema.ts` via `index()` Drizzle + migrasi remote terverifikasi (`PRAGMA index_list`). Pasangan per form: portal murid → sekolah+status verified; lookup-order → sekolah opsional+min 3 char; admin siswa → sekolah+status; pesanan → sekolah+payment+fulfillment; retur → sekolah+status retur; katalog → kategori (bila >2rb). Butir (c) ditegakkan **secara menyeluruh** oleh `check:plans`: setiap kolom ber-partisi (`…schoolId`) **wajib jadi kolom PERTAMA sebuah indeks**, diperiksa lewat `PRAGMA` dari DB migrasi (bukan teks schema, agar drift deklarasi-vs-migrasi ikut ketahuan); pengecualian didaftarkan di `REGISTERED_UNPARTITIONED` beserta alasan. Inilah kelas cacat #109 — read list `WHERE school_id = ?` tanpa indeks jadi `SCAN`, dan dulu lolos hijau karena audit gate hanya memandang pencarian substring (`matchLower`/`%q%`), bukan pembacaan partisi biasa.
4. **FTS5 Tahap 2 saja**: FTS (virtual table + trigger) hanya atas bukti `EXPLAIN QUERY PLAN` masih `SCAN` dan p95 >500ms setelah Tahap 1, untuk pencarian global lintas-sekolah. Query FTS wajib token-prefix (`salsa*` menjangkau "Annisa Salsabila"), bukan `%...%`.
5. **Bukti wajib**: endpoint search baru/ubah wajib mendaftarkan query-nya di `QUERIES` dan file sumbernya di `REGISTERED_SEARCH_SOURCES` (`scripts/explain-plan.ts`) + test volume di `src/server/routes/*.test.ts`. Gate `check:plans` menolak file yang memakai `matchLower`/`matchAnyLower` atau pola `%${...}%` yang belum terdaftar (langsung **merah**), sehingga daftar bukti tidak bisa tertinggal dari kode.

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

### Skill lokal

Satu pohon skill kanonik: **`.agents/skills/`** — itu sumber kebenaran lokal, dan isinya bisa lebih banyak daripada daftar skill yang diiklankan tool, jadi cari daftar tambahan di sana. `skills/` dan `.claude/skills/` adalah **junction** ke pohon itu, bukan duplikat; jangan disalin atau diseragamkan. Folder tool lain (`.opencode/`, `.gemini/`, …) juga mirror dan diabaikan dari pencarian oleh `.ignore` di root.

### Location & auth pointer

Lokasi transaksi aktif dikunci ke penugasan akun di `src/App.tsx`; header hanya badge tampilan (`src/components/layout/AppHeader.tsx`); scope server di `src/server/services/access-scope.ts`. Mulai dari tiga titik ini dulu. Modul layanan ber-seam tinggal di direktori (`services/return/index.ts`), bukan file datar — bila `<nama>.ts` tak ada, coba `<nama>/index.ts` dulu sebelum grep luas.

