# Tasks

## 1. Database Schema & Migration

- [x] 1.1 Sesuaikan schema `internal_shipments` agar `internal_po_id` bersifat opsional/nullable dan pastikan kolom `destination_school_id` tersedia, lalu verifikasi `bun run db:generate` menghasilkan SQL migrasi yang valid
- [x] 1.2 Terapkan migrasi ke database lokal dan verifikasi schema dengan `bun run db:push` serta `bun run db:query "PRAGMA table_info('internal_shipments')"`

## 2. Portal Siswa: Validasi Bukti Transfer & Batasan Paket

- [x] 2.1 Update form checkout portal siswa (`StudentOrderStep.tsx` / `PackageSelectionStep.tsx`) untuk menyembunyikan/menonaktifkan opsi "Kirim ke Rumah" pada pesanan paket buku, dan verifikasi tampilannya di browser/unit test
- [x] 2.2 Terapkan validasi wajib unggah bukti transfer di form checkout portal siswa (tombol submit disabled sebelum bukti diunggah), serta verifikasi dengan unit test komponen
- [x] 2.3 Tambahkan validasi sisi server di endpoint/service order intake (`src/server/services/order-intake/` atau route terkait) untuk menolak pemesanan tanpa bukti transfer, dan verifikasi dengan automated regression test

## 3. Integrasi PO Cabang ke Gudang Pusat

- [x] 3.1 Periksa dan perbaiki query list PO Cabang di sisi server agar PO berstatus aktif dari cabang muncul di dashboard/antrean Gudang Pusat, dan verifikasi via API test
- [x] 3.2 Sediakan endpoint `/api/internal-po/outstanding` untuk mengambil daftar PO cabang yang belum selesai beserta sisa item yang belum terkirim, dan verifikasi respons endpoint

## 4. Pembuatan Surat Jalan & Editable Suggestions

- [x] 4.1 Implementasikan antarmuka pembuatan Surat Jalan dengan dropdown PO Cabang terutang yang secara otomatis mengisi saran item kirim ke dalam tabel form
- [x] 4.2 Tambahkan kemampuan edit kuantitas riil atau hapus baris item pada tabel saran Surat Jalan sebelum diterbitkan, dan verifikasi interaksinya
- [x] 4.3 Tambahkan toggle mode "Pengiriman Manual Tanpa PO" dengan pemilihan cabang tujuan langsung pada form Surat Jalan, dan verifikasi penyimpanan pengiriman manual tanpa referensi PO
- [x] 4.4 Perbarui template cetak/tampilan fisik Surat Jalan agar mencantumkan nomor PO referensi (jika ada) dan keterangan rincian kirim

## 5. Konfirmasi Penerimaan di Cabang & Sinkronisasi Status PO

- [x] 5.1 Implementasikan endpoint dan UI konfirmasi penerimaan Surat Jalan oleh admin cabang saat barang tiba secara fisik
- [x] 5.2 Hitung pemenuhan akumulatif item PO Cabang secara otomatis (`partially_delivered` vs `completed`) saat Surat Jalan dikonfirmasi, dan verifikasi perubahannya via automated test

## 6. Verifikasi & Quality Checks

- [x] 6.1 Jalankan `bun run check:all` (type-check, lint, test, file-size, dan contract checks) dan verifikasi seluruh gate lulus hijau
