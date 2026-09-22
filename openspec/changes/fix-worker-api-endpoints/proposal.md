## Why

Aplikasi Book Inventory mengalami kegagalan fungsi di Cloudflare Worker dan local development pada 4 alur utama: registrasi buku katalog baru, pencetakan eksemplar fisik buku, konfirmasi penerimaan transfer, dan pembuatan draf transfer inter-school. Hal ini disebabkan oleh validasi ID Zod yang terlalu ketat (`.uuid()`) terhadap entitas seed/custom ID, skema D1 remote yang belum tersinkronisasi (kolom `reason` belum ada di tabel `transfer_shipments`), serta ketiadaan error feedback di UI ketika API mengembalikan respons non-200.

## What Changes

- **Backend Validation Relaxation**: Mengubah validator Zod di endpoint transfer shipments dan batch generate copies dari `z.string().uuid()` menjadi `z.string().min(1)` agar kompatibel dengan seluruh format ID entitas (UUID maupun seeded string ID seperti `school-alw-1`, `book-camb-01`, `item-alw1-1-001`).
- **Database Schema Sync for Remote D1**: Mengaplikasikan migrasi kolom `reason` pada tabel `transfer_shipments` ke database remote Cloudflare D1 agar penulisan draf transfer tidak melempar error SQLite `no such column: reason`.
- **Frontend Action Error Handling & Feedback**:
  - Menambahkan penanganan error yang jelas dan feedback UI (notifikasi/alert) pada `handleBatchGenerate` (`CatalogView.tsx`) dan `handleReceive` (`TransfersView.tsx`) agar tidak lagi membisu saat terjadi kendala.
  - Memperbaiki penanganan pesan error pada `handleCreateBook` (`CatalogView.tsx`) dan `handleCreateQuickTransfer` (`InventoryView.tsx`) untuk menampilkan detail pesan validasi server alih-alih fallback generik.
- **Robust Subquery & Execution in Shipments Receive**: Memastikan alur `handleReceive` mengeksekusi update status dan kondisi buku secara andal dan tahan terhadap perbedaan environment Cloudflare D1 / Bun SQLite.

## Capabilities

### New Capabilities
- `worker-api-resilience`: Standarisasi validasi ID fleksibel dan pelaporan error yang tangguh untuk semua operasi mutasi API di lingkungan Cloudflare Workers dan SQLite lokal.

### Modified Capabilities

## Impact

- **Affected Code**:
  - `src/server/routes/shipments.ts`: Skema validasi Zod `createShipmentSchema` dan `receiveShipmentSchema`.
  - `src/server/routes/bookItems.ts`: Skema validasi Zod `batchGenerateCopiesSchema`.
  - `src/views/CatalogView.tsx`: Error handling & feedback pada `handleCreateBook` dan `handleBatchGenerate`.
  - `src/views/TransfersView.tsx`: Error handling & feedback pada `handleReceive`.
  - Database Cloudflare D1 remote (`transfer_shipments` table).
- **APIs**: Tidak ada breaking change, payload tetap sama namun tidak lagi menolak format ID non-UUID v4.
