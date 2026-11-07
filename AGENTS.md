# Coding & Workflow Conventions for Book Inventory

Berkas ini adalah panduan implementasi terpusat dan navigasi aturan kanonik untuk agen dan developer. Standar yang dibaca **saat review** (katalog gate, smell baseline, checklist UI, rasional insiden) ada di [CODING_STANDARDS.md](./CODING_STANDARDS.md) — jangan diduplikasi di sini.

---

## 0. Navigasi Aturan Domain (Context Pointers)

Aturan anti-kambuh domain (§0.1 s/d §0.56) telah dimodularisasi ke dalam dokumen tematik di `docs/rules/`. Ditegakkan mekanis oleh `check:rule-pointers` (panjang file AGENTS.md maks. 150 baris). Sebelum mengimplementasikan fitur atau memodifikasi file pada path tertentu, agen **wajib membaca dokumen aturan terkait**:

| Domain / Area Modifikasi | Path Target Kode | File Aturan Wajib | Cakupan Mandat Anti-Kambuh & Invarian |
|---|---|---|---|
| **Portal Publik & UI Klien** | `src/components/portal/**`, `src/server/routes/public-*`, `src/lib/public-portal-url.ts` | [`docs/rules/portal-client.md`](./docs/rules/portal-client.md) | Kontrak API publik `/api/public/*`, tab data-driven, draf pesanan, intake seam murid, transisi login/logout staf, anti-tautologi predikat UI, no-silent-catch, form validation feedback loop, unifikasi portal client (§0.1–§0.3, §0.6, §0.8, §0.12, §0.14, §0.45–§0.48, §0.63, §0.67). |
| **Pesanan, Kasir & Keuangan** | `src/server/services/payment-ledger.ts`, `src/server/services/order-*`, `src/views/OrdersView.tsx` | [`docs/rules/orders-payments.md`](./docs/rules/orders-payments.md) | Single-writer struk/ledger (`payment-ledger`), kelayakan order, review kasir & klaim bayar, sinkronisasi WPR, guard serah terima fisik, alur retur & pembatalan pengunduran diri, realokasi penggantian pesanan, auto-populate PO demand siswa (§0.4, §0.5, §0.21, §0.22, §0.28, §0.29, §0.31, §0.35, §0.38, §0.50, §0.53, §0.59). |
| **Gudang, Seragam & Logistik** | `src/server/services/stock/**`, `src/server/services/uniform/**`, `src/views/Uniform*.tsx` | [`docs/rules/logistics-stock.md`](./docs/rules/logistics-stock.md) | Single-writer stok seragam (`uniform/stock`), pergerakan stok agregat (`moveInventoryStock`), roaming lokasi transaksi gudang, alokasi stok FIFO terpadu, audit rekonsiliasi term BA, status transfer internal, scoping global multi-cabang, parser katalog seragam & size chart (§0.7, §0.9, §0.15, §0.16, §0.20, §0.39, §0.44, §0.52, §0.56, §0.61, §0.62). |
| **Database & Cloudflare D1** | `src/db/**`, `drizzle/**`, `src/server/lib/d1-*`, `src/server/seed*.ts` | [`docs/rules/database-d1.md`](./docs/rules/database-d1.md) | Integritas skema & anti-string-packing, batching seeder & mutasi masal D1, anti-drift migrasi remote D1, validasi file bukti dokumen, factory test fixtures, integrasi drive stream in-memory, migrasi D1 non-destruktif, penyelarasan katalog & pengadaan aman-D1, konstanta sekolah & runner D1 Bun (§0.10, §0.11, §0.19, §0.26, §0.27, §0.30, §0.34, §0.54, §0.55, §0.57, §0.64, §0.65, §0.66). Detail teknis batasan D1 §10 juga tinggal di sini. |
| **Testing, CI & Otomasi** | `test/**`, `scripts/**`, `playwright.config.ts`, `tsconfig.json` | [`docs/rules/testing-tooling.md`](./docs/rules/testing-tooling.md) | Disiplin shell pwsh, artefak bersih anti-blob, test E2E mutasi aktif, isolasi actor test, kompilasi inkremental, otomasi demo Playwright tanpa error banner, batasan ukuran upload base64, target test eksplisit, portabilitas path skrip, dekomposisi proaktif UI modal (§0.13, §0.17, §0.18, §0.23–§0.25, §0.32, §0.33, §0.36, §0.37, §0.40–§0.43, §0.49, §0.51, §0.58, §0.60). |
| **Standar Review Arsitektur** | — (Dibaca saat review PR) | [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) | Katalog gate mekanis, smell baseline, checklist UI, lane ownership, dan matriks kepemilikan single-writer. |

---

## 1. Post-Modification Quality Checklist

1. **Loop per tiket**: `bun test <file>` untuk umpan balik cepat, lalu `bun run check:fast` sebelum commit. `check:fast` menjalankan `scripts/check-changed.ts` untuk seluruh file berubah (gate yang sama dengan pre-commit, termasuk `check:dead` dan `check:single-writer`). Jangan menjalankan `check:all` setiap commit — suite penuh sekali per PR.
2. **Skema berubah** → `bun run db:push` (lokal, idempoten; `--all` untuk DB baru) lalu migrasi remote D1: `bun run db:generate` → terapkan SQL ke `book-inventory-db --remote` → verifikasi. `bun run check:d1-drift` wajib hijau sebelum merge yang menyentuh skema. Baca data lokal via `bun run db:query` (baca-saja).
3. **Migrasi destruktif** (`DROP`, ubah kolom breaking) dilarang diterapkan ke remote sebelum PR merge **dan** deploy (pola expand-contract dua PR). Sebut perubahan destruktif di deskripsi PR (ADR-0013).
4. **Tipe** — `bun run type-check` nol error. `AppDatabase` schema-aware: biarkan inferensi, jangan anotasi `$inferSelect` manual pada JOIN, jangan tutup celah dengan `any`/cast baru.
5. **API & validator** — identifier entity memakai `idSchema` (`src/server/lib/validators.ts`), bukan `z.string().uuid()`. Setiap file route wajib berpasangan `*.test.ts`, dan setiap modifikasi file route wajib menambah skenario di sana (`check:route-tests --diff` menegakkan kegagalan keras exit 1).
6. **Frontend & Batch Intake** — dilarang `fetch` tanpa penanganan kegagalan: setiap respons `!ok`/`success: false` wajib menampilkan pesan yang mengekstrak `message`/`error` (pakai `lib/api.ts`). Loop batching intake eksternal wajib menerapkan jeda pacing (~800ms) dan menyediakan tombol retry per-item yang gagal. Test komponen UI meniru `StudentSearchStep.test.tsx` (shim `test-dom` + dynamic import `@testing-library/react`).
7. **Verifikasi penutup** — `bun run check:all` hijau sekali sebelum merge, dan isi bagian **“Perubahan perilaku”** di PR.

---

## 2. Technology Stack Standards

- **Runtime/PM**: Bun (Node.js fallback). **Backend**: Hono + TypeScript. **DB**: Drizzle ORM di atas SQLite (D1 Cloudflare, SQLite file untuk produksi lokal). **Frontend**: React + Vite. **Storage**: R2/S3-compatible.
- **Shell**: PowerShell 7+ (`pwsh`). Tanpa `head`/`awk`/`wc`/`printf`/`cat`/`grep`/`tail`/`rm`; untuk pencarian teks cepat pakai `rg` (ripgrep) atau `Select-String`, `Select-Object`/`Measure-Object`, `Remove-Item`, dan tool `Grep`/`Read`. Tulis path eksplisit; skrip sekali-pakai ditulis via tool `Write` lalu `bun <file>`.

---

## 3. Architecture & Domain Invariants

1. **Aggregate Inventory & Legacy Unit Tracking**: saldo buku dan paket dikelola secara agregat kuantitas (`book_stocks`, `package_stocks`); pelacakan unit eksemplar fisik barcode (`book_items`) diarsipkan sebagai read-only historis.
2. **Branch Isolation**: admin cabang hanya mengakses inventori sekolahnya (`current_school_id = branch_id`).
3. **Inter-school Transfers**: perpindahan buku lewat shipment formal (`draft` → `pending_dispatch` → `in_transit` → `completed`/`discrepancy`).
4. **Staff Roles & Navigation Boundaries**:
   - backend: `src/server/services/access-scope.ts` (`STAFF_ROLES`, `LOGISTICS_ROLES`, `resolveRequestActor`);
   - frontend: `src/lib/staff-roles.ts` (`getDefaultTabForRole`, `getRoleBadgeLabel`, `is*Role`);
   - tab: `src/components/layout/staff-tabs.ts` (`TAB_IDS`, `ActiveTab`, `DESKTOP_TABS`, `getVisibleTabsForRole`) dirender oleh `components/layout/AppTabsNavigation.tsx`.

---

## 4. Agent Workflow (Delegation, Lanes, CI)

1. **Satu kali retry, lalu kerjakan sendiri**: delegasi gagal → coba ulang 1×, setelah itu implementasi langsung.
2. **Default sekuensial**: satu tiket per commit, satu integration branch.
3. **Paralel hanya bila manifest ada**: fan-out diizinkan bila lane file-disjoint di **satu working tree** dan `docs/agents/lanes.json` dideklarasikan.
4. **Aturan lane** (`CODING_STANDARDS.md` §8): file bersama (`schema.ts`, `public-orders.ts`, dsb.) milik satu lane. Commit + gate repo-wide dijalankan serial oleh agent utama yang wajib menutup dengan `check:all`.
5. **Pantau CI dengan cek singkat berinterval**: satu `gh pr checks` tiap beberapa menit, bukan polling panjang yang memblokir.
6. **Dilarang commit ke `main`/`master` & Dilarang Commit Kosong**: mendarat lewat branch + PR, ditegakkan branch guard di pre-commit hook (bypass darurat: `ALLOW_MAIN_COMMIT=1`). Setiap commit tiket wajib berisi perubahan kode nyata (`git diff --cached --quiet` ditolak oleh empty-commit guard, bypass: `ALLOW_EMPTY_COMMIT=1`).

---

## 5. Bun Version & Lockfile

Cloudflare build memakai `bun@1.2.15` (`packageManager`) + `--frozen-lockfile`; lockfile v2 dari bun lebih baru gagal dibaca. Perintah pengubah lockfile: `npx -y bun@1.2.15 install`. Rincian: `CODING_STANDARDS.md` §5.

---

## 6. Test Isolation & Disiplin Tulis D1 Production

1. `bun test` wajib di DB sementara terisolasi (`test/setup.ts` via preload `bunfig.toml`); dilarang mengarahkan test ke D1 atau mematikan preload (`check:test-isolation`). Test baru wajib mandiri (seed ID unik, bersihkan di `finally`/`cleanup`).
2. **Dilarang** QA manual/skrip/test ke API production (`*.workers.dev`) yang membuat data bernama `*Test*`, `Sekolah school-*`, `SUP-WF-*`, dsb. Pola-uji kanonik: `isTestSeedValue` (`src/server/lib/validators.ts`). Alarm remote: `bun run check:d1-junk` + cron harian.
3. **Akses Remote D1 & Eksekusi Runner**: Query langsung ke D1 remote mengandalkan sesi login Wrangler (`npx wrangler whoami`). Jika sesi belum login atau kedaluwarsa, agen wajib segera memberitahu pengguna agar login di terminal interaktif (`npx wrangler login`). Input secret wrangler non-interaktif wajib lewat pipe: `echo "val" | npx wrangler secret put KEY`. Eksekusi file SQL remote D1 (`--file=...`) wajib dijalankan via runtime Bun (`bun run db:d1:exec` atau `bun run wrangler ...`), dilarang memakai `npx wrangler` guna menghindari crash GC `FileHandle` di Node v26 Windows (§10.9).
4. `bun run db:d1:exec ...` yang menulis (terutama `DELETE` massal) wajib didahului: verifikasi target, `SELECT COUNT(*)` contoh baris, dan cek nol relasi anak.
5. **Worktree & Node Modules**: Pembuatan git worktree di Windows wajib segera menghubungkan dependensi via junction (`cmd /c mklink /J <worktree>\node_modules <main>\node_modules`) agar tool test dan compile tidak gagal menemukan modul.
6. **Kamus Sekolah & Peta Test**: Referensi ID sekolah wajib memakai `SCHOOL_IDS` (`src/server/lib/school-constants.ts`, §0.65). Seluruh unit test server wajib co-located di `src/server/*.test.ts`, bukan di `test/server/` (§0.51).

---

## 7. Code Maintainability & File-Size Gate

Setiap file `src/**/*.ts(x)` maksimal **400 baris** (kecuali `*.test.ts(x)`, `src/db/schema.ts`, `src/server/seed.ts`, `*.d.ts`). File melebihi batas wajib dipecah: view → sub-komponen + hook + tipe; route Hono → logika ke `src/server/services/`. Utang lama terdaftar di `GRANDFATHERED` (`scripts/check-file-size.ts`) dan hanya boleh menyusut. Verifikasi: `check:file-size`.

---

## 8. YAGNI, One-Liner Discipline & Single-Writer

- Dilarang speculative generality: wrapper sekali pakai wajib jadi fungsi polos atau inline.
- Helper duplikat dikanonikalisasi ke pemilik tunggal (`lib/curriculum.ts`, `lib/transfer-pricing.ts`, `lib/book-pricing.ts`, `lib/api.ts`, `lib/staff-roles.ts`, `lib/book-return.ts`, dsb.). Penegak mekanis: `check:canonical-helpers` + `check:single-writer`.
- Kode mati dihapus beserta test-nya (`check:dead`).
- Dilarang hardcoded host path (`D:/...`, `C:\...`) di seluruh skrip/kode (`check:no-hardcoded-paths`).
- Prefer one-liner ekspresif (`map`/`filter`/`reduce`/`??`). Pengecualian D1: `Promise.all` hanya untuk query BACA independen; TULIS wajib sekuensial atau satu `db.batch()`.
- Refactor dilarang mengubah perilaku tanpa test baru dan catatan eksplisit di PR.

---

## 9. Code Smell & Tech Debt Elimination

1. Sesi yang menyentuh `src/` diawali pemindaian smell read-only dan diakhiri eliminasi sesuai scope.
2. Katalog smell dan sinyal review ada di `CODING_STANDARDS.md` §2 dan §7.
3. Dilarang menambah utang baru: `any`, helper duplikat, `@ts-ignore`/`eslint-disable` baru, `console.log` produksi, atau silent-catch (`check:no-any`, `check:canonical-helpers`, `check:no-silent-catch`).

---

## 10. Cloudflare D1 & Search Discipline

- **Aturan Tulis D1**: Chunking maksimal 10 baris per `INSERT` (maksimal 5 baris untuk tabel lebar seperti `students`), dilarang `Promise.all` untuk tulis, mutasi induk-anak atomik via `db.batch()`, error constraint dipetakan lewat `d1WriteErrorStatus()`. Detail lengkap di [`docs/rules/database-d1.md`](./docs/rules/database-d1.md).
- **Aturan Baca D1**: Query `inArray(col, ids)` berpotensi meluap di production (>100 params); wajib pakai `selectInChunks` (`d1-write.ts`). Cold-start worker dilarang melempar error saat bundling (`wrangler deploy --dry-run`).
- **Search Discipline**: Dilarang `SELECT`-all + filter JS (filter wajib di `WHERE` SQL). Substring `%q%` publik wajib terpartisi `school_id = ?` + `LIMIT 10–50` + indeks komposit (`check:plans`). Detail teknis di `CODING_STANDARDS.md` §6.

---

## 11. Edit Anchor Discipline

1. Jangkar `oldString` minimal 3 baris dengan pengenal unik (nama fungsi, string khas, komentar sekitar).
2. Dilarang jangkar generik satu baris (`});`, `}`, `return ...`, baris kosong).
3. `replaceAll` path bertingkat: sertakan kutip penutup dan ganti path terpanjang lebih dulu (`check:imports`).

---

## Agent skills & navigation pointers

- **Standar review**: `CODING_STANDARDS.md` (katalog gate, smell, checklist UI, rasional insiden).
- **Issue tracker**: GitHub Issues via `gh` (`dittorahmat/book-inventory`) — `docs/agents/issue-tracker.md`; label triage: `docs/agents/triage-labels.md`.
- **Domain docs**: `GLOSSARY.md` + `docs/adr/` (`docs/agents/domain.md`).
- **Skill lokal**: pohon kanonik `.agents/skills/`. `skills/` dan `.claude/skills/` adalah junction.
- **Portal publik**: URL→tab di `src/lib/public-portal-url.ts`; daftar tab di `src/components/portal/portal-tabs.ts`; state alur di `src/components/portal/use*.ts`; adapter HTTP tunggal `src/components/portal/portal-api.ts`; route di `src/server/routes/public-*.ts`.
- **Master & Paket Buku**: mutasi BOM & lifecycle paket di `src/server/services/package-mutation.ts`; kitting fisik di `src/server/services/package-assembly.ts`; otorisasi buku di `resolveBookLogisticsActor` / `isBookWarehouseStaffRole`. Pembedaan tab UI: **Gudang Buku** (`/books`) adalah master buku satuan (`books`), sedangkan **Paket Buku** adalah master paket bundling BOM (`book_packages`).
- **Master CRUD & Deletion Guards**: penghapusan entitas master (murid, buku, seragam, paket) wajib memvalidasi ketiadaan pesanan aktif (`shipmentStatus = 'belum_dikirim'` / non-`picked_up`) dan saldo stok fisik gudang. Cascade delete entitas berelasi anak wajib dieksekusi secara atomik via `runWriteBatch` (§10.3). Tombol mutasi admin di antarmuka web wajib diproteksi predikat peran kanonik (`isBookWarehouseStaffRole`, `isUniformStaffRole`, atau `isCentralRole`).
- **Seeding Stok & Portabilitas Skrip**: mutasi saldo stok awal wajib lewat seam `moveInventoryStock` (§0.62) atau `seedInitialBookStock`, dilarang merakit raw SQL insert ke `book_stocks`. Skrip generator data wajib path-relatif portabel dan berkas SQL disimpan di `data/sql/` (bukan `drizzle/`).
- **Lokasi & auth (staf)**: lokasi transaksi dikunci ke penugasan akun di `src/App.tsx`; header hanya badge (`src/components/layout/AppHeader.tsx`); scope server di `src/server/services/access-scope.ts`. Modul layanan ber-seam tinggal di direktori (`services/<domain>/index.ts`).
- **Sub-Agent & Asynchronous Execution**: hindari polling loop (`schedule` timer pendek / `manage_subagents list`). Sistem runtime otomatis membangkitkan parent agent (*reactive wakeup*) seketika sub-agent mengirimkan pesan (`send_message`). Cukup akhiri turn tanpa timer buatan.
- **Eksekusi Perintah & Tool Economy**: pemanggilan command check, lint, compile, dan test (`bun run check:*`, `bun test`) wajib menyertakan batas sinkronus maksimal `WaitMsBeforeAsync: 10000` (10s) agar tidak terlempar prematur ke background task. Pencarian teks cepat (`rg`) wajib mengarahkan path target eksplisit (`src/`, `test/`), dilarang recursive scan root tanpa path argumen. Subagent review dibatasi read-only lokal (diff dan workspace internal) tanpa dependensi jaringan eksternal.
- **Form Validation & Interactive Feedback (§0.63)**: tombol submit form wajib interaktif dan dilarang `disabled` pasif saat field belum lengkap (`check:form-buttons` terintegrasi di `check:fast`). Validasi kesalahan wajib menampilkan garis merah, `FormFieldFeedback`, `FormSummaryAlert`, auto-focus input pertama, koordinasi draft dalam model state terpadu (anti-data-clump), delegasi filter ke predikat domain, dan alokasi wajib memakai single-writer `allocationViolation`.
- **Schema & Upload Gate**: seluruh field base64 route publik (`*Base64`, `*Proof*`) wajib memakai `base64UploadSchema` atau `.max(...)` (`check:base64-schemas`).
