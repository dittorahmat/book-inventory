# Coding & Workflow Conventions for Book Inventory

Berkas ini mengarahkan **implementasi**. Standar yang dibaca **saat review**
(katalog gate, smell baseline, checklist UI, rasional insiden) ada di
`CODING_STANDARDS.md` — jangan diduplikasi di sini.

---

## 0. Mandat anti-kambuh

Aturan anti-kambuh (Okt 2026). Yang mekanis ditutup gate/tipe, bukan disiplin;
rincian kepemilikan tiap modul ada di `CODING_STANDARDS.md` §10.

1. **Kontrak path API.** Setiap literal `/api/...` di klien wajib menunjuk route
   yang terdaftar, dan portal publik hanya boleh memanggil `/api/public/*`.
   Ditegakkan `bun run check:api-contract` (pre-commit, CI, `check:all`). Menambah
   endpoint berarti: daftarkan di router, lalu pakai path itu dari klien.
2. **Navigasi data-driven.** Daftar tab/nav wajib array data (`PUBLIC_TABS`,
   `DESKTOP_TABS`), bukan JSX inline. Tab baru = entry array + test yang mengunci
   daftar (`PortalTabs.test.tsx`, `staff-tabs.test.ts`). JSX inline membuat tab
   rusak/hilang lolos `type-check`, `lint`, dan `build`.
3. **Fitur baru wajib punya pintu masuk yang teruji.** Sebelum lapor selesai,
   buktikan jalur yang membuka UI itu ada (tab, tautan, atau URL→tab mapping di
   `src/lib/public-portal-url.ts`) dan punya test. Komponen yang tidak bisa
   dicapai dari UI = fitur belum jadi, walau semua gate hijau.
4. **Struk Bayar** — satu pembentuk baris (`payment-ledger`) dan satu pembaca;
   baris `payment_receipts`/`payment_allocations` hanya lewat modul itu
   (`check:single-writer`). Duplikat bank + referensi = 409.
5. **Kelayakan order** — satu aturan untuk buku dan seragam
   (`student-eligibility`); pencarian portal membawa `canOrder` yang sama dengan
   penegakan submit.
6. **Tab staf** — `TAB_IDS` + `STAFF_TAB_RENDERERS` berpasangan; `Record<ActiveTab,
   …>` membuat tab tanpa renderer gagal `type-check`.
7. **Stok seragam** — semua mutasi lewat `uniform/stock`
   (`check:single-writer`), dengan kebijakan `require`/`create`/`skip` eksplisit.
8. **Draf portal** — state + transisi di `useOrderDraft`; step menerima
   `{ draft, actions }`, bukan belasan pasangan nilai/setter. Server tetap
   otoritas validasi terakhir.
9. **Lokasi & Branch Roaming Gudang** — header (`AppHeader.tsx`) tetap badge
   identitas murni tanpa mutasi global lokasi transaksi; pemilihan cabang untuk
   role gudang/logistik dilakukan di tingkat view/tab transaksi spesifik (filter
   view, form pengiriman, dan selector query), bukan menimpa state penugasan akun.
10. **Integritas Skema & Anti-String-Packing** — data terstruktur domain (seperti
    nomor WA manual, tautan dokumen finance) wajib dialokasikan di kolom skema
    resmi atau objek terstruktur, dilarang dipadatkan (packed) ke dalam string
    catatan bebas (`notes`) dengan tag parsing darurat (`[WA: ...]`).
11. **Disiplin Validasi Bukti Dokumen** — input bukti dokumen (seperti Surat Jalan
    atau surat rekomendasi) wajib menyediakan alur upload file (data-URL/blob/storage)
    dan penambahan validasi wajib tidak boleh merusak pemanggil lama tanpa migrasi
    lengkap di diff yang sama.
12. **Anti Parameter Inversion pada API Client** — endpoint klien dengan 2+ parameter
    primitif (terutama kombinasi string `query` dan `schoolId`) wajib menerima objek
    parameter terstruktur (misal `{ query, schoolId }`). Setiap custom hook data-fetching
    portal wajib memiliki unit regression test (`use*.test.ts`) yang memverifikasi query
    string URL terkirim dengan parameter yang tepat.
13. **Disiplin PowerShell & Shell Tools** — saat menjalankan perintah CLI yang menulis
    teks multibaris / markdown bertanda backtick (misal `gh pr create --body`), hindari
    interpolasi string inline langsung di PowerShell pwsh karena karakter backtick `
    dapat memicu error escape sequence; gunakan argumen file (`--body-file <file>`)
    atau single-quoted here-string (`@' ... '@`).
14. **Intake Seam Portal Tunggal** — seluruh alur pencarian dan identifikasi murid
    portal (buku, seragam, dsb.) wajib memakai modul hook intake kanonik
    `useStudentSearch` (`src/components/portal/useStudentSearch.ts`), dilarang
    membuat state search/debouncing inline di view atau menduplikasi modal murid baru.
15. **Seam Alokasi Stok Terpadu** — alokasi fisik berbasis FIFO (`allocateInventoryStock`
    di `src/server/services/stock/allocation.ts`) adalah titik masuk tunggal untuk
    unit satuan maupun bundel paket; hindari percabangan pemanggil langsung ke implementasi
    tabel terpisah.
16. **Otoritas Server pada Audit Rekonsiliasi** — alur Berita Acara / Rekonsiliasi
    akhir periode (`term-reconciliation`) wajib server-authoritative; input fisik
    dapat disubmit mandiri tanpa mewajibkan kalkulasi delta atau penarikan ulang angka
    inbound di sisi klien.
17. **Disiplin Artefak Bersih & Anti-Blob Liar** — dilarang melakukan commit atas
    file biner liar atau dokumen presentasi/ekspor PDF/DOCX (`*.pdf`, `*.docx`, dsb.)
    ke dalam tree git; dokumentasi spesifikasi dan skenario sistem wajib berformat teks
    markdown murni (`.md`). Ditegakkan mekanis oleh `check:clean-artifacts`.
18. **Integritas Test E2E & Validasi Alur Mutasi Aktif** — integration test E2E
    skenario bisnis dilarang hanya membaca data pasif (`GET` assertions belaka); setiap
    skenario operasional (seperti PO pengadaan, transfer shipment kirim-terima,
    tukar seragam, penolakan bukti bayar, dan pembatalan pesanan) wajib menguji
    mutasi alur (`POST`/`DELETE`/`PATCH`) hingga status akhir dokumen tervalidasi.
19. **Disiplin Batching D1 pada Seeder** — seluruh penambahan data di seeder (`seed.ts`
    maupun `seed-demo/*.ts`) wajib mematuhi batas chunking D1 (maksimal 10 baris per
    statement `INSERT ... VALUES` via `chunkRows` atau `runWriteBatch`), dilarang
    melakukan perulangan insert satu per satu (`insert().values({ ... })` tunggal).
20. **Kontrak Status & Skema Transfer Logistics** — status seragam kanonik pada
    level backend adalah `sudah_dikirim` (bilingual guard: hindari inferensi enum bahasa
    Inggris `shipped` pada seragam); transfer buku internal (`/api/shipments`)
    menghasilkan nomor dokumen berprefix `TRF-*` (`shipmentNumber`), dan payload draft
    items wajib menyertakan discriminator `{ itemType: "loose" | "package", ... }`.
21. **Disiplin Seam Tinjau Pembayaran & Kasir** — seluruh mutasi pembayaran kasir
    manual dan verifikasi klaim bukti transfer (buku maupun seragam) wajib memusat
    ke `order-payment-review` (`src/server/services/order-payment-review.ts`). Parameter
    alokasi kanonik pada level service adalah `allocationAmount` (alias backward-compatible
    `bookAllocationAmount` dinormalisasi di pintu masuk schema validator tanpa membiarkan
    primitive obsession merembes ke domain internal).
22. **Integritas Seam Siklus Hidup Murid & Verifikasi** — seluruh transisi status
    pendaftaran siswa (`new_pending` → `active`/`rejected`) dan penegakan keunikan NIS
    resmi wajib tinggal di balik modul layanan `student-lifecycle` (`src/server/services/student-lifecycle.ts`),
    dilarang melakukan query mutasi SQL langsung (`UPDATE students`) dari handler router.
23. **Disiplin Kompilasi Inkremental & Timeout Pre-Commit** — `tsconfig.json` wajib
    mengaktifkan `"incremental": true` dengan `tsBuildInfoFile` terabaikan git
    (`tsconfig.tsbuildinfo`). Pada Windows pwsh, tipe-checking dan pre-commit hook
    harus memanfaatkan cache inkremental agar tidak melampaui ambang batas timeout eksekusi tools CLI.
24. **Disiplin Regression Test Delegasi Router-ke-Seam** — setiap ekstraksi logika bisnis
    dari router Hono ke modul domain/seam (`services/*`) wajib mempertahankan atau menambahkan
    test di level route (`*.test.ts`) yang memverifikasi pemetaan status HTTP dan payload
    respons secara eksplisit (termasuk kasus error 400/404/409 dan delegasi parameter alias).
25. **Disiplin Browser Automation & Otomasi E2E** — script otomasi browser (Playwright dsb.)
    dilarang hanya melakukan inspeksi pasif (sekadar cek tombol atau navigasi tab belaka);
    setiap skenario wajib mengeksekusi mutasi aktif/aksi form (isi input, klik submit, unggah dokumen),
    menyimpan bukti tangkapan layar (screenshot visual) pada checkpoint hasil, dan menghindari
    sleep arbitrer (`waitForTimeout` membabi-buta) dengan mengutamakan asersi web eksplisit
    (`waitForLoadState`, `toBeVisible`, atau penantian elemen spesifik).
26. **Integritas Penamaan Entitas & Anti-Residual Identifier** — saat melakukan perubahan identitas
    nama data demo/domain (seperti nama siswa, kode akun, atau nomor referensi), lakukan penyelarasan
    menyeluruh hingga ke ID slug seeded (`id`, `orderId`, `receiptId`) untuk mencegah bau kode
    leaky identifier / mismatch kognitif antara nama tampilan dan kunci relasi database. Ditegakkan
    mekanis oleh gate `check:seed-integrity`.
27. **Disiplin Batch Updates Mutasi Masal D1** — seluruh operasi pembaruan masal multi-baris
    (seperti kenaikan kelas murid `batchPromoteStudents`, mutasi status katalog, atau pengalihan lokasi)
    wajib mengelompokkan ID target ke dalam chunk aman D1 (`chunkRows` dari `src/server/lib/d1-write.ts`)
    dan menggunakan predikat set `inArray(table.id, chunk)` atau `db.batch()`, dilarang mengeksekusi
    perulangan `database.update().where(eq(id))` satu per satu.

---

## 1. Post-Modification Quality Checklist

1. **Loop per tiket**: `bun test <file>` untuk umpan balik cepat, lalu
   `bun run check:fast` sebelum commit. `check:fast` menjalankan
   `scripts/check-changed.ts` untuk seluruh file berubah (gate yang sama dengan
   pre-commit, termasuk `check:dead` dan `check:single-writer`). Jangan
   menjalankan `check:all` setiap commit — suite penuh sekali per PR. Daftar gate
   dan urutannya adalah field `check:all` di `package.json` (CI memakai urutan
   yang sama di `.github/workflows/checks.yml`); arti tiap gate ada di
   `CODING_STANDARDS.md` §1.
2. **Skema berubah** → `bun run db:push` (lokal, idempoten; `--all` untuk DB baru)
   lalu migrasi remote D1: `bun run db:generate` → terapkan file SQL ke
   `book-inventory-db --remote` → verifikasi. Bukti tanpa tebak: `bun run check:d1-drift`
   wajib hijau sebelum merge yang menyentuh skema (alarm cron harian menutup celah
   "tidak ada yang menjalankannya"). Baca data lokal dengan `bun run db:query`
   (baca-saja) alih-alih skrip sekali-pakai.
3. **Migrasi destruktif** (`DROP`, ubah kolom yang mematahkan kode lama) dilarang
   diterapkan ke remote sebelum PR merge **dan** deploy — urutannya dua PR
   (kode berhenti memakai → merge/deploy → PR drop). Sebut perubahan destruktif di
   deskripsi PR. Detail: ADR-0013.
4. **Tipe** — `bun run type-check` nol error. `AppDatabase` schema-aware: biarkan
   inferensi, jangan anotasi `$inferSelect` manual pada JOIN, jangan tutup celah
   dengan `any`/cast baru.
5. **API & validator** — identifier entity memakai `idSchema`
   (`src/server/lib/validators.ts`), bukan `z.string().uuid()`; setiap endpoint
   mutasi punya test dengan ID slug seeded maupun UUID. Setiap file route wajib
   berpasangan `*.test.ts`, dan setiap bug API yang diperbaiki wajib menambah
   skenario di sana.
6. **Frontend** — dilarang `fetch` tanpa penanganan kegagalan: setiap respons
   `!ok`/`success: false` wajib menampilkan pesan yang mengekstrak `message`/`error`
   (pakai `lib/api.ts`; error-nya `ApiError` bertipe). `required` pada
   `SearchableSingleSelect`/`SearchableMultiSelect` wajib didampingi guard JS +
   pesan inline, dan label lama dihapus (dilarang label ganda). Test komponen UI
   meniru `src/components/portal/StudentSearchStep.test.tsx` (shim `test-dom` +
   dynamic import `@testing-library/react`); `@testing-library/user-event` tidak
   terinstal.
7. **Verifikasi penutup** — `bun run check:all` hijau sekali sebelum merge, dan
   isi bagian **“Perubahan perilaku”** di PR (kosong untuk refactor murni; lihat
   `CODING_STANDARDS.md` §10).

---

## 2. Technology Stack Standards

- **Runtime/PM**: Bun (Node.js fallback). **Backend**: Hono + TypeScript.
  **DB**: Drizzle ORM di atas SQLite — D1 di Cloudflare, SQLite file untuk
  produksi mandiri. **Frontend**: React + Vite. **Storage**: R2/S3-compatible.
- **Shell**: PowerShell 7+ (`pwsh`). Tanpa `head`/`awk`/`wc`/`printf`/`cat`/`grep`/
  `tail`/`rm`; untuk pencarian teks cepat pakai `rg` (ripgrep) atau `Select-String`,
  `Select-Object`/`Measure-Object`, `Remove-Item`, dan tool `Grep`/`Read`. `mkdir`
  satu direktori per perintah; glob tidak mengembang di argumen skrip — tulis path
  eksplisit. Skrip sekali-pakai ditulis via tool `Write` lalu `bun <file>`, bukan `bun -e`
  berkutip bersarang.

---

## 3. Architecture & Domain Rules

1. **Physical Unit Tracking**: buku dilacak per eksemplar (`book_items`) dengan
   barcode unik, kondisi fisik, dan penugasan sekolah.
2. **Branch Isolation**: admin cabang hanya mengakses inventori sekolahnya
   (`current_school_id = branch_id`).
3. **Inter-school Transfers**: perpindahan buku lewat shipment formal
   (`draft` → `pending_dispatch` → `in_transit` → `completed`/`discrepancy`).
4. **Staff Roles & Navigation Boundaries** — kanonik, dilarang routing ad-hoc:
   - backend: `src/server/services/access-scope.ts` (`STAFF_ROLES`,
     `LOGISTICS_ROLES`, `resolveRequestActor`);
   - frontend: `src/lib/staff-roles.ts` (`getDefaultTabForRole`,
     `getRoleBadgeLabel`, `is*Role`);
   - tab: `src/components/layout/staff-tabs.ts` (`TAB_IDS`, `ActiveTab`,
     `DESKTOP_TABS`, `getVisibleTabsForRole`) dirender oleh
     `components/layout/AppTabsNavigation.tsx` (komponen saja).

---

## 4. Agent Workflow (Delegation, Lanes, CI)

1. **Satu kali retry, lalu kerjakan sendiri**: delegasi gagal → coba ulang 1×,
   setelah itu implementasi langsung. Jangan biarkan user menunggu.
2. **Default sekuensial**: satu tiket per commit, satu integration branch.
3. **4.4 Paralel hanya bila manifest ada**: fan-out diizinkan tanpa izin per-sesi
   bila lane file-disjoint di **satu working tree** dan `docs/agents/lanes.json`
   dideklarasikan. Worktree terpisah tetap dilarang (biaya install + merge).
4. **4.5 Aturan lane** (rincian: `CODING_STANDARDS.md` §8): file bersama
   (`schema.ts`, `public-orders.ts`, `settings*.ts`, `drizzle/**`) milik satu lane;
   lane dilarang `git add/commit/checkout` dan dilarang `lint`/`build`/`bun test`
   penuh — hanya `bun test <file>`; `type-check` read-only boleh, perbaiki hanya
   file lane sendiri dan laporkan sisanya. Commit + gate repo-wide dijalankan
   serial oleh agent utama, yang wajib menutup dengan `check:all`.
5. **Pengecualian**: refactor cross-cutting yang menyentuh file bersama boleh satu
   commit agar tiap commit tetap buildable.
6. **Pantau CI dengan cek singkat berinterval** — satu `gh pr checks` tiap
   beberapa menit, bukan polling panjang yang memblokir.
7. **4.8 Dilarang commit ke `main`/`master`**: mendarat lewat branch + PR,
   ditegakkan branch guard di `scripts/githooks/pre-commit` (bypass sengaja:
   `ALLOW_MAIN_COMMIT=1`). Verifikasi branch aktif (`git branch --show-current`)
   sebelum git commit pertama di sesi kerja.

---

## 5. Bun Version & Lockfile

Cloudflare build memakai `bun@1.2.15` (`packageManager`) + `--frozen-lockfile`;
lockfile v2 dari bun lebih baru gagal dibaca. Perintah pengubah lockfile:
`npx -y bun@1.2.15 install`. Rincian: `CODING_STANDARDS.md` §5.

---

## 6. Test Isolation & Disiplin Tulis D1 Production

1. `bun test` wajib di DB sementara terisolasi (`test/setup.ts` via preload
   `bunfig.toml`); dilarang mengarahkan test ke D1 (remote/lokal) atau mematikan
   preload — ditegakkan `check:test-isolation`. Test baru wajib mandiri (seed ID
   unik, bersihkan di `finally`/`cleanup`) agar run berulang tidak menumpuk baris.
2. **Dilarang** QA manual/skrip/test ke API production (`*.workers.dev`) yang
   membuat data bernama `*Test*`, `Sekolah school-*`, `SUP-WF-*`, dan pola
   sejenis; QA destruktif hanya di dev lokal. Pola-uji kanonik:
   `isTestSeedValue` (`src/server/lib/validators.ts`); ekspor seed fail-closed;
   alarm remote `bun run check:d1-junk` + cron harian (`d1-junk-alert.ts`,
   `d1-drift-alert.ts`, kunci sidik di `system_settings`).
3. `wrangler d1 execute ... --remote` yang menulis (terutama `DELETE` massal)
   wajib didahului: verifikasi target (`database_name`/`database_id`),
   `SELECT COUNT(*)` + contoh baris berpredikat sama, dan cek nol relasi anak.

---

## 7. Code Maintainability & File-Size Gate

Setiap file `src/**/*.ts(x)` maksimal **400 baris** (kecuali `*.test.ts(x)`,
`src/db/schema.ts`, `src/server/seed.ts`, `*.d.ts`). File yang melebihi batas
wajib dipecah sebelum lapor selesai: view → sub-komponen di
`src/components/<fitur>/` + hook `use<Fitur>` + API layer + tipe di
`src/lib/<fitur>-types.ts`; route Hono → logika ke `src/server/services/`.
Utang lama terdaftar di `GRANDFATHERED` (`scripts/check-file-size.ts`) dan hanya
boleh menyusut — kode fitur **baru** wajib lahir di file baru yang patuh batas.
Verifikasi: `check:file-size` (diff-scoped; `--all` di CI).

---

## 8. YAGNI & One-Liner Discipline

- Dilarang speculative generality: factory/provider/class wrapper sekali pakai
  wajib jadi fungsi polos atau inline.
- Helper duplikat dikanonikalisasi ke pemilik tunggal: `lib/transfer-pricing.ts`
  (rupiah/total), `lib/book-pricing.ts` (client-safe) + `server/services/pricing.ts`
  (server), `lib/api.ts` (fetch), `lib/staff-roles.ts`,
  `components/layout/staff-tabs.ts` (`ActiveTab`, `getVisibleTabsForRole`), dan
  `lib/book-return.ts` (batas foto + status refund). Daftar pemilik modul baru +
  pola tulis terlarang: `CODING_STANDARDS.md` §10; penegak mekanisnya
  `check:canonical-helpers` + `check:single-writer`.
- Kode mati dihapus beserta test-nya, bukan dikomentari (`check:dead`). Ekspor
  baru wajib segera dihubungkan ke pemanggil (call-site) atau diuji agar tidak
  mematahkan gate `check:dead` saat refactor bertahap.
- Prefer one-liner: guard/loop verbose yang setara `map`/`filter`/`reduce`/`??`/
  ternary satu baris bila perilakunya sama.
- **Pengecualian D1**: `Promise.all` hanya untuk query BACA independen; TULIS
  wajib sekuensial atau satu `db.batch()` (§10).
- Refactor dilarang mengubah perilaku. Perubahan perilaku yang disengaja wajib
  dipisah dari refactor, dicatat di bagian “Perubahan perilaku” PR, dan dikunci
  test skenario baru (`CODING_STANDARDS.md` §10). Alias tipis dipertahankan bila
  public API dipakai route/test.

---

## 9. Code Smell & Tech Debt Elimination

1. Setiap sesi yang menyentuh `src/` diawali pemindaian smell read-only
   (`Grep`/`rg`, tanpa edit) dan diakhiri eliminasi sesuai scope yang disepakati.
2. Katalog smell, daftar helper kanonik, dan sinyal review ada di
   `CODING_STANDARDS.md` §2 dan §7 — periksa semuanya, jangan hanya yang diingat.
3. Perbaikan: kanonikalisasi ke modul yang ada, satu perilaku per perubahan,
   setiap bug yang diperbaiki disertai regression test.
4. Dilarang menambah utang baru: `any`, helper duplikat, `@ts-ignore`/
   `eslint-disable` baru, `console.log` produksi, atau silent-catch = belum boleh
   lapor selesai (`check:no-any`, `check:canonical-helpers`).

---

## 10. Cloudflare D1 & Workers Write Discipline

Latar dan bukti: `CODING_STANDARDS.md` §6. Aturan yang mengikat:

1. Satu statement `INSERT ... VALUES` maksimal **10 baris**, dieksekusi
   sekuensial (chunked).
2. `Promise.all` **dilarang** untuk tulis; pakai sekuensial atau `db.batch()`.
3. Alur induk + anak wajib atomik (`db.batch()` di D1, fallback sekuensial di
   bun-sqlite) atau idempoten dengan validasi pra-tulis yang mengembalikan 400.
4. Constraint (`UNIQUE`/`FOREIGN KEY`) wajib dipetakan ke 4xx lewat
   `d1WriteErrorStatus()` (`src/server/lib/d1-write.ts`); kegagalan infra
   (`D1_ERROR`) wajib dilempar ulang agar menjadi 500 + ref, bukan 400 palsu.
5. Endpoint tulis bervolume wajib diuji ≥30 baris sekaligus di
   `src/server/routes/*.test.ts`.

---

## 11. Search Discipline (Anti Full-Scan)

Latar dan bukti: `CODING_STANDARDS.md` §6. Aturan yang mengikat:

1. Dilarang `SELECT`-all + filter JS; filter wajib di `WHERE` SQL. Katalog kecil
   (<2rb baris: `books`, `packages`) boleh difilter di frontend.
2. Substring `%q%` endpoint publik wajib terpartisi `school_id = ?`; endpoint
   staf sentral boleh global tetapi tetap `WHERE` SQL + `LIMIT 50`.
3. Setiap endpoint search: filter partisi + `LIMIT` 10–50 + indeks komposit
   dengan kolom partisi sebagai kolom **pertama** (diperiksa `check:plans` lewat
   `PRAGMA`, bukan teks schema). Pengecualian didaftarkan beralasan di
   `REGISTERED_UNPARTITIONED`/`REGISTERED_UNBOUNDED_READS`.
4. FTS5 hanya tahap 2 setelah `EXPLAIN QUERY PLAN` masih `SCAN` dan p95 >500ms;
   query FTS wajib token-prefix (`salsa*`), bukan `%...%`.
5. Query search baru/ubah wajib didaftarkan di `QUERIES` +
   `REGISTERED_SEARCH_SOURCES` (`scripts/explain-plan.ts`) dan diuji volumenya.

---

## 12. Edit Anchor Discipline

1. Jangkar `oldString` minimal 3 baris dengan pengenal unik (nama fungsi, string
   khas, komentar sekitar) sehingga hanya cocok di satu lokasi.
2. Dilarang jangkar generik satu baris (`});`, `}`, `return ...`, baris kosong).
   Tool menolak karena multi-match → perluas konteks, jangan persempit.
3. `replaceAll` path bertingkat: sertakan kutip penutup dan ganti path terpanjang
   lebih dulu; ditegakkan `check:imports`.

---

## Agent skills & navigation pointers

- **Standar review**: `CODING_STANDARDS.md` (katalog gate, smell, checklist UI,
  rasional insiden).
- **Issue tracker**: GitHub Issues via `gh` (`dittorahmat/book-inventory`) —
  `docs/agents/issue-tracker.md`; label triage: `docs/agents/triage-labels.md`.
- **Domain docs**: `GLOSSARY.md` + `docs/adr/` (`docs/agents/domain.md`).
- **Skill lokal**: satu pohon kanonik `.agents/skills/` (isinya bisa lebih banyak
  dari yang diiklankan tool). `skills/` dan `.claude/skills/` adalah junction;
  folder tool lain (`.opencode/`, `.gemini/`, …) mirror — jangan disalin.
- **Portal publik**: URL→tab di `src/lib/public-portal-url.ts`; daftar tab di
  `src/components/portal/portal-tabs.ts`; state alur di
  `src/components/portal/use*.ts`; adapter HTTP tunggal
  `src/components/portal/portal-api.ts`; route di `src/server/routes/public-*.ts`.
- **Lokasi & auth (staf)**: lokasi transaksi dikunci ke penugasan akun di
  `src/App.tsx`; header hanya badge (`src/components/layout/AppHeader.tsx`);
  scope server di `src/server/services/access-scope.ts`. Modul layanan ber-seam
  tinggal di direktori (misal `services/return/index.ts`, `services/order-intake/index.ts`,
  `services/uniform/index.ts`), bukan file datar — bila `<nama>.ts` tak ada, coba
  `<nama>/index.ts` sebelum grep luas.
