# ADR-0015: Logistik Terpadu Cabang, Pergantian Program, dan Peran Finance Cabang

- **Status**: Accepted
- **Tanggal**: 2026-11-10
- **Konteks**:
  Operasional distribusi buku pendidikan memerlukan kepastian fisik dan finansial antara Gudang Pusat dan Cabang Sekolah:
  1. Pengiriman buku ke cabang harus langsung memotong stok gudang pusat saat status Surat Jalan menjadi `in_transit`, namun stok cabang belum bertambah sampai cabang memverifikasi checklist fisik dan mengunggah foto Surat Jalan bertanda tangan & cap basah.
  2. Terminologi "Kurikulum" di antarmuka publik, admin, dan notifikasi membingungkan pengguna dan perlu diselaraskan menjadi istilah umum "Program" (misal: Reguler, Tahfidz, Cambridge).
  3. Konfirmasi pembayaran oleh wali murid meresmikan pesanan menjadi Invoice yang dapat ditagih ke Finance Cabang, disertai pengiriman WhatsApp Blast resmi yang teksnya dapat dikonfigurasi (*configurable template*).
  4. Finance Cabang membutuhkan hak akses khusus *read-only* terisolasi per sekolah untuk memantau rekap tagihan per jenjang & program tanpa hak mutasi stok atau pesanan.
  5. Penguncian mutasi program siswa: hanya bisa dilakukan oleh Logistik Pusat atau PIC Cabang dengan bukti dokumen sekolah. Jika buku sudah diambil fisik (`picked_up`), wajib melalui prosedur retur fisik buku lama terlebih dahulu sebelum program baru dapat diterbitkan.
  6. Penarikan sisa paket di cabang menjelang akhir tahun ajaran dapat ditarik oleh Gudang Pusat melalui menu Rakit Paket (via *Cross-Branch Stock Roaming*) dan langsung dibongkar otomatis (*auto-unbundle*) menjadi stok satuan di Gudang Pusat.

## Keputusan Arsitektur

1. **Lifecycle Pengiriman Surat Jalan**:
   - Status shipment: `draft` -> `in_transit` -> `received`.
   - Transisi ke `in_transit` secara atomik memotong `book_stocks` / `package_stocks` di Gudang Pusat.
   - Cabang mengonfirmasi penerimaan via modal checklist dan unggahan berkas Surat Jalan TTD; mutasi penambahan stok cabang dieksekusi secara atomik saat konfirmasi valid.

2. **Terminologi Program**:
   - Seluruh label UI, dropdown filter, kolom tabel, export, dan pesan WhatsApp menggunakan kata "Program".
   - Kolom basis data (`curriculum`) dipertahankan tanpa perubahan skema destruktif, dipetakan pada lapisan DTO / Service.

3. **Peran Baru `branch_finance`**:
   - Ditambahkan ke `STAFF_ROLES` dengan scope akses data terisolasi ke `schoolId` akun penugasan.
   - Diberikan tab khusus rekapitulasi invoice & pembayaran (`branch_finance_invoices`) dengan mode *read-only*.

4. **Konfigurasi WhatsApp Blast Template**:
   - Disimpan pada `system_settings` dengan kunci `payment_confirmation_wa_template`.
   - Mendukung token interpolasi: `{nama_murid}`, `{nis}`, `{program}`, `{jenjang}`, `{nama_sekolah}`, `{kode_pengambilan}`.

5. **Guard & Alur Pergantian Program**:
   - Endpoint mutasi program murid memvalidasi peran (`LOGISTICS_ROLES` atau `branch_admin`).
   - Wajib melampirkan berkas bukti persetujuan sekolah.
   - Jika status fisik pesanan `picked_up`, aksi ditolak kecuali terdapat pencatatan retur fisik buku lama dengan lampiran bukti foto fisik buku.
   - Nilai pembayaran lama dialihkan ke pesanan program baru melalui *Payment Re-allocation* pada `payment-ledger`.

6. **Tarik & Bongkar Paket Cabang (Auto-Unbundle)**:
   - Ditempatkan di tab Gudang Buku -> Rakit Paket dengan in-view roaming selector lokasi cabang.
   - Aksi penarikan mengurangi saldo `package_stocks` di cabang dan menambahkan komponen satuan BOM ke `book_stocks` Gudang Pusat dalam satu batch transaksi.

## Konsekuensi

- **Positif**:
  - Eliminasi selisih stok gaib antara gudang dan cabang berkat tracking status transit dan upload bukti fisik TTD.
  - Otorisasi finansial cabang terpisah rapi tanpa risiko modifikasi inventaris oleh staf non-logistik.
  - Fleksibilitas komunikasi wali murid terjaga melalui template pesan dinamis.
  - Integritas data murid dan barang fisik terjamin saat terjadi perubahan program akademik.
- **Batasan**:
  - Upload file Surat Jalan dan bukti retur tunduk pada batasan payload D1/Worker (`base64UploadSchema`).
