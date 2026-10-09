## 1. Database Schema & Migration

- [x] 1.1 Tambahkan field diskresi finance (`finance_handover_approved`, `discount_amount`, `discretion_type`, `discretion_notes`, `discretion_by_user_id`) pada `student_book_orders` di `src/db/schema.ts` dan verifikasi dengan `bun run type-check`
- [x] 1.2 Buat tabel `purchase_order_receipts` untuk pencatatan No. Surat Jalan dan rincian penerimaan parsial supplier di `src/db/schema.ts`
- [x] 1.3 Buat skema tabel `internal_purchase_orders`, `internal_shipments`, dan `internal_shipment_items` untuk alur PO Cabang ke Pusat di `src/db/schema.ts`
- [x] 1.4 Buat skema tabel `vendor_returns` untuk pencatatan retur ke supplier di `src/db/schema.ts`
- [x] 1.5 Jalankan `bun run db:push` dan `bun run db:generate` untuk memastikan migrasi database lokal dan remote siap diterapkan

## 2. Manajemen Siswa & Bulk Upload Upsert

- [x] 2.1 Buat endpoint `PUT /api/students/:id` untuk edit data siswa di `src/server/routes/students.ts` dan tambahkan regression test-nya
- [x] 2.2 Buat endpoint bulk import `POST /api/students/bulk-import` dengan strategi upsert (chunking 10 baris per eksekusi D1) di `src/server/routes/students.ts`
- [x] 2.3 Tambahkan komponen UI Edit Siswa Modal dan tombol Bulk Upload dengan template CSV/Excel di `src/views/StudentsView.tsx`

## 3. Form Pemesanan Siswa, Partial Payment & Diskresi Finance

- [x] 3.1 Perbaiki validasi `StudentOrderPaymentStep` agar nominal di bawah total harga dapat diproses sebagai `PARTIAL` payment tanpa diblokir
- [x] 3.2 Buat endpoint diskresi finance `POST /api/student-orders/:id/discretion` (potong harga, gratis 100%, dispensasi izin ambil) di `src/server/routes/student-orders.ts`
- [x] 3.3 Perbarui validasi serah terima buku di `src/server/services/order-fulfilment.ts` agar mengizinkan serah terima jika `payment_status === 'PAID'` ATAU `finance_handover_approved === true`
- [x] 3.4 Tambahkan UI kontrol Diskresi Finance di tampilan detail pesanan admin

## 4. Inbound PO Supplier dengan Surat Jalan & Parsial

- [x] 4.1 Buat service penerimaan PO dengan nomor surat jalan dan kalkulasi outstanding kuantiti di `src/server/services/po-receipt.ts`
- [x] 4.2 Tambahkan endpoint `POST /api/purchase-orders/:id/receipts` dan verifikasi unit test di `src/server/routes/purchase-orders.test.ts`
- [x] 4.3 Tambahkan form input No. Surat Jalan fisik dan visualisasi timeline penerimaan bertahap di halaman PO Inbound

## 5. Alur PO Internal Cabang, Rakit Gudang & Multi Surat Jalan

- [x] 5.1 Batasi menu dan endpoint rakit paket hanya untuk Gudang Pusat (HQ) di `src/server/routes/packages.ts`
- [x] 5.2 Implementasikan endpoint `POST /api/internal-orders` bagi Cabang untuk menerbitkan PO Paket ke Pusat
- [x] 5.3 Buat alur multi Surat Jalan Pengiriman Internal (`POST /api/internal-orders/:id/shipments`) untuk pengiriman bertahap paket/outstanding tanpa duplikasi PO
- [x] 5.4 Sediakan antarmuka kasir penjualan buku satuan langsung ke orang tua di Gudang Pusat yang memotong stok satuan non-paket

## 6. Refund Orang Tua & Retur ke Supplier (RTV)

- [x] 6.1 Ubah formulir publik retur buku rusak menjadi formulir permohonan Refund Orang Tua di `src/views/PublicReturnView.tsx`
- [x] 6.2 Buat endpoint verifikasi dan eksekusi refund di Gudang Pusat yang mengembalikan dana dan menambah kembali stok buku
- [x] 6.3 Buat modul Retur ke Supplier (`POST /api/vendor-returns`) untuk mengeluarkan buku rusak/kelebihan dan mencatat nota retur kredit

## 7. WhatsApp Notification Service Bridge

- [x] 7.1 Buat service client `src/server/services/whatsapp.ts` berbasis HTTP fetch ke endpoint gateway/sidecar eksternal yang aman di Cloudflare Workers
- [x] 7.2 Pasang trigger notifikasi WhatsApp otomatis saat order siswa terbuat dan saat PO diterbitkan
- [x] 7.3 Sediakan halaman pengaturan WhatsApp di dashboard admin (konfigurasi endpoint gateway & test pesan)

## 8. Verifikasi Kualitas Akhir

- [x] 8.1 Jalankan `bun run type-check` dan pastikan 0 error TypeScript
- [x] 8.2 Jalankan `npm run lint` dan pastikan bebas lint warning/error
- [x] 8.3 Jalankan `bun test` untuk memastikan semua test suite dan regresi baru lulus
- [x] 8.4 Jalankan `bun run check:file-size` untuk memastikan kepatuhan batas 400 baris kode
