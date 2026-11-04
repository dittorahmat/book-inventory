# Schema Architecture & Scope Overview

Dokumen ini memetakan scope kepemilikan dan relasi tabel-tabel utama di database sistem Al-Wildan untuk mencegah asumsi keliru saat penulisan kode atau data fixture pengujian.

---

## 1. Global / Curriculum-Level Entities (Tanpa `school_id`)

Tabel-tabel ini berlaku secara terpusat untuk seluruh cabang/sekolah:

| Tabel | Primary Key | Kolom Kunci / Keterangan | Catatan Penting |
| :--- | :--- | :--- | :--- |
| `books` | `id` | `isbn` (UNIQUE), `title`, `grade_level`, `curriculum_type`, `academic_year` | **TIDAK memiliki `school_id`**. Judul buku berlaku universal. |
| `book_packages` | `id` | `code` (UNIQUE), `name`, `grade_level`, `curriculum_type`, `academic_year`, `price` | **TIDAK memiliki `school_id`**. Paket buku didefinisikan per jenjang & kurikulum terpusat. |
| `book_package_items` | `id` | `package_id`, `book_id`, `quantity` | BOM (Bill of Materials) paket buku. |
| `uniform_variants` | `id` | `code` (UNIQUE), `kind` (kain_harian/olahraga), `jenjang`, `gender`, `price` | Katalog varian seragam terpusat. |
| `uniform_packages` | `id` | `code` (UNIQUE), `name`, `academic_year`, `price` | Paket seragam terpusat. |

---

## 2. School-Scoped Entities (Wajib Memiliki `school_id`)

Tabel-tabel yang terikat langsung pada lokasi sekolah fisik atau cabang:

| Tabel | Primary Key | Foreign Key Sekolah | Keterangan |
| :--- | :--- | :--- | :--- |
| `students` | `id` | `school_id` $\rightarrow$ `schools.id` | Murid terdaftar di cabang tertentu. |
| `student_book_orders` | `id` | `school_id` $\rightarrow$ `schools.id` | Pesanan buku murid pada cabang murid. |
| `package_items` | `id` | `current_school_id` $\rightarrow$ `schools.id` | Fisik bundel paket buku yang berada di gudang cabang. |
| `book_items` | `id` | `current_school_id` $\rightarrow$ `schools.id` | Fisik buku satuan yang berada di gudang cabang. |
| `branch_internal_orders` | `id` | `from_school_id`, `to_school_id` | Transfer internal antar-cabang/gudang. |
| `uniform_stock` | `id` | `school_id` $\rightarrow$ `schools.id` | Stok fisik seragam per cabang/gudang. |

---

## 3. Financial & Ledger Entities

| Tabel | Penulis Tunggal (*Single Writer*) | Identitas Unik / Relasi |
| :--- | :--- | :--- |
| `payment_receipts` | `src/server/services/payment-ledger.ts` | Bank + nomor referensi (`bank_name`, `reference_number`). |
| `payment_allocations` | `src/server/services/payment-ledger.ts` | Terhubung ke `receipt_id` dan `order_id` (buku atau seragam). |
| `refund_slips` | `src/server/services/refund-slip.ts` | Slip pengembalian dana (`slip_number`). |
