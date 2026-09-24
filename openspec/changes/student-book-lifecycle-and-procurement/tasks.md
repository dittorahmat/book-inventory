## 1. Database Schema & Data Models

- [x] 1.1 Perluas skema database di `src/db/schema.ts` untuk menambahkan tabel `students`, `suppliers`, `purchase_orders`, `purchase_order_items`, `book_packages`, `book_package_items`, `package_items`, `student_book_orders`, `order_payments`, `book_returns`, dan `system_settings` lalu verifikasi dengan `bun run type-check`.
- [x] 1.2 Terapkan migrasi skema lokal dan sinkronisasi remote Cloudflare D1 sesuai panduan AGENTS.md, verifikasi dengan perintah status db.

## 2. Master Data Buku, Paket & Logika Bundling/Unbundling

- [x] 2.1 Buat endpoint backend API di `src/server/routes/packages.ts` untuk manajemen master paket buku, definisi BOM komponen buku satuan, transaksi kitting (bundling) dan de-kitting (unbundling) dan verifikasi dengan unit test.
- [x] 2.2 Buat antarmuka UI manajemen bundling di frontend (`src/views/PackagesView.tsx` dan `BundlingModal.tsx`) untuk memantau stok dua tingkat (*loose* vs *bundle*) dan eksekusi rakit/bongkar paket.

## 3. Portal Formulir Publik Orang Tua & Alur Beasiswa

- [x] 3.1 Implementasikan endpoint API publik di `src/server/routes/public-orders.ts` untuk pencarian siswa cerdas (NIS/nama), deteksi kenaikan kelas, registrasi siswa baru, dan submit pesanan buku (reguler & beasiswa).
- [x] 3.2 Bangun halaman web publik frontend responsif (`src/views/PublicOrderView.tsx`) dengan alur pencarian interaktif, pemilihan paket buku, upload bukti beasiswa 100%, dan upload bukti pembayaran beserta konfirmasi nominal buku.

## 4. Modul Kasir, Verifikasi Pembayaran & Approval Beasiswa

- [x] 4.1 Buat endpoint API verifikasi keuangan di `src/server/routes/payments.ts` yang mendukung pencatatan pembayaran cicilan/parsial, input konfirmasi alokasi buku, dan persetujuan berkas beasiswa.
- [x] 4.2 Tambahkan antarmuka kasir/keuangan di dashboard untuk memvalidasi bukti transfer, memeriksa alokasi nominal buku dari transfer gabungan, dan memberikan persetujuan beasiswa.

## 5. Dashboard Operasional, Surat Jalan & Manajemen Retur

- [x] 5.1 Kembangkan endpoint API di `src/server/routes/student-orders.ts` untuk melacak status pesanan murid, penerbitan surat jalan serah terima paket, dan pencatatan retur buku cacat dengan lampiran foto bukti.
- [x] 5.2 Rancang antarmuka dashboard operasional (`src/views/StudentOrdersView.tsx` dan `src/views/BookReturnsView.tsx`) dengan matriks filter status pembayaran & status buku, cetak tanda terima penyerahan, dan penanganan retur buku.

## 6. Pengadaan Supplier (Purchase Order)

- [x] 6.1 Buat endpoint API di `src/server/routes/procurement.ts` untuk manajemen supplier, pembuatan PO, pengiriman PO, dan konfirmasi penerimaan barang fisik ke stok buku satuan.
- [x] 6.2 Bangun antarmuka modul pengadaan supplier di frontend (`src/views/ProcurementView.tsx`) untuk memantau siklus PO dan penerimaan barang masuk.

## 7. Layanan Notifikasi Email (SMTP)

- [x] 7.1 Bangun modul email service di `src/server/services/email.ts` yang mendukung konfigurasi SMTP dinamis dari database, pengujian koneksi SMTP, dan pengiriman email otomatis (konfirmasi order, approval bayar/beasiswa, kesiapan pickup).
- [x] 7.2 Tambahkan menu konfigurasi pengaturan SMTP di pengaturan admin dan verifikasi pengiriman email uji coba.

## 8. Perombakan Total Data Demo & Pengujian Integrasi

- [x] 8.1 Rombak total skrip seed data demo di `src/server/routes/demo.ts` untuk memuat siswa lama (seperti Hendra Wahyudi), siswa baru, master buku & paket, variasi pesanan (lunas, cicilan, beasiswa, retur cacat), supplier PO, dan stok berlapis.
- [x] 8.2 Jalankan rangkaian test integrasi (`npm run test`), type-check (`npm run type-check`), linting (`npm run lint`), dan build (`npm run build`) untuk memastikan seluruh fungsi berjalan sempurna tanpa error.
