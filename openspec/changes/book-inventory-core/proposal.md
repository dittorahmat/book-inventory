## Why

Sekolah membutuhkan sistem inventaris buku yang andal untuk mengontrol pergerakan stok fisik buku antara cabang utama (kantor pusat/gudang utama) dan sekolah cabang anak. Sistem ini memastikan setiap eksemplar buku terpantau status, kondisi fisik, dan lokasi sekolahnya, serta mencegah hilangnya buku saat proses distribusi antar sekolah.

## What Changes

- **School & Multi-Branch Management**: Mendukung entitas sekolah cabang utama dan cabang anak dengan isolasi hak akses inventaris untuk admin cabang.
- **Book Catalog & Cover Image Management**: Pengelolaan katalog judul buku (metadata ISBN, judul, pengarang, penerbit) dan upload cover gambar buku menggunakan penyimpanan kompatibel S3/R2.
- **Physical Copy (Item) Tracking**: Pelacakan unit buku fisik (`book_items`) dengan kode barcode/asset tag unik, kondisi fisik (`new`, `good`, `fair`, `damaged`), dan status ketersediaan.
- **Inter-School Transfer Logistics (Shipments)**: Alur formal mutasi pengiriman buku antar cabang (`draft` -> `pending_dispatch` -> `in_transit` -> `completed` / `discrepancy`).
- **Flexible SQLite Core**: Skema database Drizzle SQLite yang dirancang untuk kompatibilitas Cloudflare D1 pada fase awal dan Bun native SQLite saat deploy ke VPS/On-Premise.
- **Clean Editorial Frontend**: Antarmuka React + Vite dengan prinsip desain anti-slop, tipografi fungsional, dan alur scan/input barcode yang efisien.

## Capabilities

### New Capabilities
- `school-management`: Pengelolaan data sekolah cabang utama dan cabang-cabang anak beserta isolasi akses data.
- `book-catalog`: Pengelolaan metadata katalog buku dan upload cover buku via Cloudflare R2 / S3 storage.
- `book-inventory`: Pelacakan unit fisik buku per eksemplar dengan asset tag/barcode, status, dan kondisi fisik.
- `inter-school-transfer`: Pengelolaan siklus pengiriman dan mutasi stok buku antar sekolah dengan pelacakan status formal dan verifikasi penerimaan.

### Modified Capabilities
<!-- None -->

## Impact

- **Backend**: Stack Bun + Hono API routes untuk schools, books, book-items, dan shipments.
- **Database**: Drizzle ORM dengan SQLite dialect (kompatibel D1 dan Bun SQLite).
- **Storage**: Abstraksi storage client untuk upload gambar cover (Cloudflare R2 Worker binding dan AWS S3 Client fallback).
- **Frontend**: Single Page Application React + Vite + TypeScript dengan dashboard distribusi stok dan scan barcode.
