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
   - **Media & R2 Asset Serving Verification (Round-Trip Test)**:
     - Setiap ada endpoint upload file / media yang menghasilkan URL (contoh: `/api/media/covers/...` atau R2 / S3 storage):
       - **WAJIB** ada route handler penyaji file (contoh: `GET /api/media/*`) yang mengembalikan stream data dengan header `Content-Type` yang tepat dan `Cache-Control`.
       - **WAJIB** memiliki integration test round-trip di `src/server/routes/*.test.ts`: test harus mengunggah file, mengambil URL hasil upload, lalu melakukan request `GET` ke URL tersebut dan memverifikasi status 200 serta kecocokan `Content-Type` dan payload. Dilarang hanya mengetes proses upload tanpa memverifikasi aksesibilitas URL yang dikembalikan ke browser.
   - **Regression Test Updates**:
     - Setiap bug atau error API yang diperbaiki **wajib ditambahkan skenario test-nya** di berkas `src/server/routes/*.test.ts` untuk mencegah regresi di kemudian hari.

6. **Frontend Aesthetics & Anti-Slop Check (`design-taste-frontend`)**
   - Jalankan skill `design-taste-frontend` untuk mencegah AI slop, layout generik, atau card-inside-card template yang murahan.
   - Pertahankan estetika editorial/minimalis yang fungsional, tipografi tegas, hierarki visual jelas, dan micro-interaction yang halus.

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
