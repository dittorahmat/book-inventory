# Tasks

## 1. Database Schema & Migration

- [x] 1.1 Tambahkan kolom `received_at` / `handover_at` pada serah terima buku siswa di `src/db/schema.ts` dan verifikasi skema valid dengan `bun run db:generate`
- [x] 1.2 Tambahkan kolom diskon logistik beasiswa parsial (`logistics_discount_pct`, `logistics_discount_approved_at`) dan slot upload bukti terima SJ di `src/db/schema.ts`
- [x] 1.3 Terapkan migrasi lokal (`bun run db:push`) dan siapkan file migrasi D1 remote

## 2. Backend API & Business Logic

- [x] 2.1 Implementasi validasi capping kuota pesanan paket cabang berbasis jumlah siswa aktif di `src/server/routes/school-orders.ts` dan tambahkan regression test di `src/server/routes/school-orders.test.ts`
- [x] 2.2 Implementasi tombol "Proses" untuk pembuatan & cetak Surat Jalan (SJ) serta endpoint upload Bukti Terima fisik ber-cap basah pada pesanan cabang
- [x] 2.3 Tambahkan endpoint ekspor data refund buku ter-approve (`GET /api/student-orders/returns/export`) di `src/server/routes/student-orders.ts`
- [x] 2.4 Implementasi endpoint input persentase diskon beasiswa parsial oleh logistik dan penegasan syarat rilis barang gudang hanya pada verifikasi cicilan pertama

## 3. Frontend & RBAC Revamp

- [x] 3.1 Rombak modul Seragam (`src/views/UniformView.tsx`) menjadi multi-tab mandiri (`UniformStockTab`, `UniformOrdersTab`, `UniformPoTab`, `UniformReturnsTab`) dengan kepatuhan batas file <400 baris
- [x] 3.2 Perbarui kontrol navigasi/sidebar: isolasi akses Admin Gudang Buku vs Admin Gudang Seragam, serta sederhanakan akses Cabang hanya ke "Pesan ke Gudang" dan "Data Siswa"
- [x] 3.3 Hapus tab/navigasi Transfer Stok lama yang redundan (prinsip YAGNI)
- [x] 3.4 Perbarui tabel Data Siswa untuk Admin Gudang Pusat agar menampilkan seluruh data siswa lintas cabang dengan filter dropdown cabang
- [x] 3.5 Tampilkan kolom "Tanggal Penerimaan Buku" pada tabel penerimaan siswa di sisi cabang dan pusat
- [x] 3.6 Ubah tab Retur Buku eksisting di `src/views/BookReturnsView.tsx` menjadi tab "Refund Buku" dengan tombol ekspor CSV dan checklist approval logistik
- [x] 3.7 Aktifkan kembali formulir publik Refund Buku sebagai tab keempat portal publik (bukan hanya deep-link): alur cabang → cari pesanan via `GET /api/public/orders/lookup-order` → pilih judul dari `GET /api/public/orders/book-choices` → alasan + foto wajib → `POST /api/public/orders/submit-return` (sumber `public`, bukan endpoint staf). Harga acuan refund tidak ditampilkan ke orang tua.

## 4. Verification & Quality Gates

- [x] 4.1 Jalankan seluruh suite test backend `bun test` dan pastikan semua test hijau
- [x] 4.2 Jalankan verifikasi kualitas penuh `bun run check:all` (type-check, lint, build, file-size, dead code) dan pastikan nol error
