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

2. **Type Safety Verification**
   ```bash
   npm run type-check
   # or bun run type-check
   ```
   Zero TypeScript errors (`tsc --noEmit`) are allowed.

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
     - Jangan memaksakan `z.string().uuid()` pada identifier entity (seperti `schoolId`, `bookId`, `bookItemId`). Selalu gunakan `z.string().min(1)` agar kompatibel dengan data demo, slug kampus (contoh: `school-alw-1`), maupun format UUID v4.
     - Setiap endpoint mutasi (POST, PATCH, PUT) **wajib memiliki unit/integration test** yang memverifikasi payload dengan custom seeded string IDs maupun UUID.
   - **Sinkronisasi Skema Remote D1 vs Lokal**:
     - Setiap ada kolom atau tabel baru di `src/db/schema.ts`, migrasi remote D1 **wajib dieksekusi** dan diverifikasi (`PRAGMA table_info`) agar endpoint API di Cloudflare Worker tidak gagal dengan error SQLite `no such column` atau `no such table`.
   - **Error Handling & User Feedback Frontend (Anti Silent Failure)**:
     - Dilarang membuat fungsi frontend (`fetch`) tanpa blok `try/catch` atau tanpa penanganan blok `else` saat `response.ok` / `data.success` bernilai `false`.
     - User interface **wajib** menampilkan alert, toast, atau pesan error eksplisit yang mengekstrak `data.message` atau `data.error` dari server, sehingga tombol tidak "diam saja" saat API mengembalikan status 400/500.
   - **Regression Test Updates**:
     - Setiap bug atau error API yang diperbaiki **wajib ditambahkan skenario test-nya** di berkas `src/server/routes/*.test.ts` untuk mencegah regresi di kemudian hari.

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

7. **Code Maintainability & Refactor Trigger**
   - Jika ukuran file kode melebihi ~250–300 baris atau komponen memikul terlalu banyak tanggung jawab, segera pertimbangkan untuk refactor ke modul, utility, atau sub-komponen terpisah.

---

## 2. Technology Stack Standards

- **Runtime & Package Manager**: [Bun](https://bun.sh/) (or Node.js fallback where applicable).
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
