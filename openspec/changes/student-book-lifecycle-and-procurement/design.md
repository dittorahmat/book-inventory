## Context

Sistem saat ini (`src/db/schema.ts`) hanya memiliki tabel `schools`, `users`, `books`, `book_items`, dan `transfer_shipments`. Model ini berfokus pada pelacakan unit fisik dasar antargudang sekolah.
Untuk mendukung perombakan proses bisnis (siklus pengadaan hingga serah terima murid), kita perlu merancang arsitektur data dan alur layanan baru yang mendukung manajemen persediaan dua tingkat (*loose* vs *bundle*), portal formulir publik, dan verifikasi keuangan bertingkat.

## Goals / Non-Goals

**Goals:**
- Merancang model data terintegrasi yang mencakup: `students`, `suppliers`, `purchase_orders`, `purchase_order_items`, `book_packages`, `book_package_items`, `package_items` (stok bundle fisik), `student_book_orders`, `student_book_order_items`, `order_payments`, `book_returns`, dan `system_settings` (SMTP).
- Menerapkan alur transaksional untuk *bundling* (kitting) dan *unbundling* (de-kitting) stok buku secara atomik di level database.
- Menyediakan endpoint API publik untuk pencarian siswa, pengisian form orang tua, pengunggahan bukti bayar/beasiswa, serta email konfirmasi otomatis.
- Membangun antarmuka dashboard kasir & logistik dengan filter status pembayaran dan kesiapan buku, cetak surat jalan penyerahan, dan penanganan retur.
- Merombak total rute demo (`src/server/routes/demo.ts`) dengan data realistis.

**Non-Goals:**
- Integrasi WhatsApp gateway pihak ketiga secara otomatis (ditunda untuk iterasi berikutnya, digantikan oleh notifikasi email SMTP).
- Integrasi *payment gateway* otomatis seperti Midtrans/Xendit (pembayaran tetap menggunakan alur transfer manual + unggah bukti bayar + verifikasi kasir).

## Decisions

### 1. Model Stok Dua Tingkat (Loose Stock vs Bundled Stock)
- **Keputusan**: 
  - Stok satuan disimpan di `book_items` (atau counter persediaan satuan per sekolah).
  - Paket jadi fisik disimpan di `package_items` dengan barcode unik (misal `PKG-ALW1-2026-0012`).
  - Disediakan tabel relasi `book_package_items` sebagai definisi BOM (Bill of Materials) yang menentukan buku apa saja dan berapa jumlahnya di dalam 1 paket.
- **Alternatif**: Hanya menghitung paket secara virtual di query SQL.
  - *Alasan ditolak*: Petugas sekolah membungkus fisik buku terlebih dahulu ke dalam kardus/plastik sebelum hari-H pembagian murid. Jika hanya virtual, fisik di gudang tidak memiliki nomor identitas dan rawan selisih saat pembagian massal.

### 2. Transaksi Bundling & Unbundling Atomik
- **Keputusan**: Logika perakitan dan pembongkaran paket dibungkus dalam blok `db.transaction()` SQLite / D1.
  - Saat *Bundle*: memotong N unit buku satuan dan membuat N baris `package_items` berstatus `in_stock`.
  - Saat *Unbundle*: menghapus/menonaktifkan N `package_items` dan mengembalikan buku satuan ke stok `in_stock`.
- **Rasional**: Mencegah kondisi *race condition* dan selisih stok jika terjadi kegagalan sistem di tengah proses.

### 3. Portal Publik Form Orang Tua
- **Keputusan**: Rute `/order` atau `/form-buku` dibuat sebagai rute publik (tidak memerlukan session autentikasi Better Auth).
  - API `/api/public/students/search` mencari siswa berdasarkan kecocokan parsial NIS atau nama murid (case-insensitive) dengan limit maksimal 10 hasil untuk menjaga privasi.
  - Formulir mendukung upload berkas foto (bukti transfer dan surat beasiswa) yang disimpan ke storage/base64 URL terenkripsi.

### 4. Penanganan Pembayaran Parsial dan Transfer Gabungan
- **Keputusan**: Pada tabel `order_payments`, disediakan kolom `transferAmount` (nominal total di mutasi bank) dan `bookAllocationAmount` (nominal spesifik yang diakui untuk buku).
  - Status pesanan: `unpaid` -> `partial` (jika `totalPaid` < `totalAmount`) -> `paid` (jika `totalPaid` >= `totalAmount`).
  - Untuk beasiswa: `scholarship_pending` -> `scholarship_approved` (dengan `totalAmount` = 0).

### 5. Email Service SMTP
- **Keputusan**: Menyimpan kredensial SMTP di tabel `system_settings` atau environment variable fallback. Menggunakan library lightweight SMTP client (seperti `nodemailer` atau Worker-compatible SMTP) untuk mengirimkan template email HTML profesional (rincian buku, nomor resi pesanan, bukti bayar).

## Risks / Trade-offs

- **[Risk] Selisih stok buku satuan vs paket jika dibongkar manual di fisik tanpa update sistem.**  
  → *Mitigasi*: Tombol "Bongkar Paket (Unbundle)" di antarmuka logistik dibuat sangat mudah diakses dengan kewajiban mengisi alasan pencatatan (audit log).
- **[Risk] Pembayaran parsial/gabungan membingungkan kasir dalam rekonsiliasi.**  
  → *Mitigasi*: Menampilkan perbandingan jelas antara "Nominal Bukti Transfer" dan "Nominal Alokasi Buku", serta riwayat cicilan bertingkat per pesanan murid.
- **[Risk] Cloudflare D1 environment limitations saat pengiriman email.**  
  → *Mitigasi*: Gunakan arsitektur worker-friendly atau API email fallback jika port raw socket SMTP dibatasi oleh Cloudflare Workers.
