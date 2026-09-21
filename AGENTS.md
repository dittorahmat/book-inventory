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

5. **Test Suite & New Tests Enforcement**
   ```bash
   npm run test
   ```
   **Requirement**: Every time a new feature is introduced or an existing behavior is modified, you **must write or update corresponding tests** to verify the behavior and prevent regressions.

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
