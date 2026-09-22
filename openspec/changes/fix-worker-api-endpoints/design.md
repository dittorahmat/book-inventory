## Context

Aplikasi dirancang untuk runtime hybrid (Bun SQLite untuk local/VPS dan Cloudflare D1 + Workers untuk edge cloud). Skema database SQLite lokal telah memiliki kolom `reason` pada `transfer_shipments`, namun database remote Cloudflare D1 belum dieksekusi migrasi penambahan kolom tersebut. Selain itu, validator backend Zod memaksakan format `z.string().uuid()` pada parameter ID, sedangkan data demo/seed menggunakan format ID berbasis slug/prefix (`school-alw-1`, `book-camb-01`, `item-alw1-1-001`), menyebabkan penolakan HTTP 400.

## Goals / Non-Goals

**Goals:**
- Melonggarkan validasi ID pada router `shipments.ts` dan `bookItems.ts` agar menerima string ID non-kosong (`z.string().min(1)`), mendukung format UUID maupun custom string.
- Mengeksekusi penambahan kolom `reason` ke database remote Cloudflare D1.
- Menambahkan error handling dan user feedback eksplisit (alert / toast) pada semua mutasi API di `CatalogView.tsx` dan `TransfersView.tsx`.
- Menyempurnakan query subquery update kondisi di `shipmentsRouter.post("/:id/receive")` agar aman dan kompatibel di D1.

**Non-Goals:**
- Mengubah skema kunci utama database (tetap `text` primary key).
- Mengubah library auth Better-Auth atau session management.

## Decisions

### 1. Relaksasi Validasi ID: `z.string().min(1)` alih-alih `z.string().uuid()`
- **Rationale**: SQLite menyimpan ID sebagai `TEXT`. Baik demo data (`school-alw-1`) maupun UUID generator runtime (`crypto.randomUUID()`) adalah teks valid. Membatasi ke UUID hanya menambah titik rapuh (brittle point) yang tidak diperlukan di layer transportasi API.
- **Alternatif**: Memaksa semua seed data diubah ke format UUID. *Ditolak* karena merusak keterbacaan data demo dan membutuhkan migrasi data yang berisiko bagi instans yang sudah berjalan.

### 2. Penataan Error Feedback di Frontend
- **Rationale**: Sebelumnya jika fetch mengembalikan status 400/500, fungsi frontend seperti `handleBatchGenerate` tidak memiliki blok `else` untuk `data.success`, sehingga modal tetap terbuka dan user mengira tombol macet. Dengan mengekstrak pesan error (`data.message || data.error || "Terjadi kesalahan"`) dan menampilkannya, user langsung mengetahui apa yang terjadi.
- **Alternatif**: Menggunakan modal error kustom baru. *Ditolak* karena `alert(...)` atau pesan status kontekstual sudah cukup konsisten dengan pola codebase yang ada.

### 3. Migrasi Remote D1 Kolom `reason`
- **Rationale**: SQL migration `drizzle/0002_superb_layla_miller.sql` berisi `ALTER TABLE transfer_shipments ADD reason text;`. Ini harus dieksekusi via `wrangler d1 execute book-inventory-db --remote --file=./drizzle/0002_superb_layla_miller.sql`.

## Risks / Trade-offs

- [Risk] Database remote D1 menolak `ALTER TABLE ADD COLUMN` jika kolom sudah ada.
  → Mitigation: Verifikasi dengan PRAGMA table_info sebelum eksekusi; kita sudah memastikan kolom `reason` belum ada di remote D1.
- [Risk] Error Zod mengembalikan format `{ error: { issues: [...] } }` bukan `{ message: string }`.
  → Mitigation: Format helper ekstraksi pesan error di frontend agar memeriksa `data.message` atau `data.error` secara fleksibel.
