# Design

## Context

Sistem inventori saat ini memiliki modul seragam yang sudah memiliki skema lengkap di database (`src/db/schema.ts`), tetapi antarmuka penggunanya menumpuk di `UniformView.tsx` tanpa pemisahan peran operasional yang jelas antara logistik buku dan seragam. Di sisi pergerakan inventori cabang, navigasi transfer buku (`TransferListView.tsx` / `TransferCreateView.tsx`) terpisah dari pesanan cabang sehingga menimbulkan duplikasi konsep transfer vs pesanan internal (YAGNI).

Fitur penanganan retur buku siswa sebenarnya **sudah memiliki backend dan tabel eksisting** (`book_returns` di schema, dan route `POST /api/student-orders/returns` serta `BookReturnsView.tsx` di frontend). Kita **tidak perlu membuat tabel atau route baru**, melainkan **mengubah (revamp)** view `BookReturnsView.tsx` menjadi tab **Refund Buku**, melengkapinya dengan tombol checklist approval logistik dan ekspor CSV, serta mengaktifkan kembali formulir publik pengajuan refund buku yang memanfaatkan endpoint eksisting tersebut.

Selain itu, belum ada capping pesanan cabang berbasis jumlah siswa aktif, belum ada rekaman bukti fisik Surat Jalan (SJ) bertanda tangan & cap basah, tanggal penerimaan buku siswa belum dicatat terpisah, dan alur beasiswa parsial memerlukan intervensi diskon logistik sebelum tagihan terbit.

## Goals / Non-Goals

**Goals:**
- Memisahkan RBAC dan antarmuka modul seragam menjadi modul gudang mandiri bertata letak multi-tab (Katalog & Stok, Pesanan, PO Vendor, Retur/Refund).
- Menyederhanakan hak akses Admin Cabang menjadi hanya 2 modul utama: **Pesan ke Gudang** dan **Data Siswa**.
- Memberikan Admin Gudang Pusat akses ke seluruh data siswa dengan filter cabang.
- Mengimplementasikan capping pesanan paket cabang maksimal sebesar jumlah siswa aktif cabang pada jenjang tersebut.
- Menyediakan tombol "Proses" di Gudang Pusat yang langsung membuka dialog Surat Jalan (SJ) untuk cetak fisik, serta menyediakan upload dokumen bukti terima (SJ bertanda tangan + cap basah).
- Menghapus modul Transfer Stok lama yang redundan.
- Mencatat dan menampilkan tanggal aktual serah terima buku siswa.
- Mengakomodasi alur diskon beasiswa parsial oleh tim logistik dan membatasi tanggung jawab rilis buku gudang hanya pada pembayaran cicilan pertama.
- **Revamp Modul Retur Eksisting**: Mengubah `BookReturnsView.tsx` menjadi **Refund Buku**, menyempurnakan aksi approval checklist logistik, menambahkan fitur ekspor data refund ke CSV, dan menghidupkan kembali form publik refund buku berbasis pencarian siswa.

**Non-Goals:**
- Pembuatan tabel database baru untuk refund buku (memanfaatkan tabel `book_returns` eksisting).
- Integrasi transfer dana otomatis (refund uang tetap diserahkan secara manual ke tim Finance).
- Penagihan cicilan ke-2, ke-3, dst. untuk beasiswa parsial di dalam modul gudang (dikelola di modul kasir/Finance).

## Decisions

### Decision 1: Pemisahan Role dan Modul Seragam
- **Pilihan**: Menambahkan/memisahkan role `warehouse_books_admin` dan `warehouse_uniforms_admin` pada RBAC serta memecah `UniformView.tsx` menjadi sub-komponen modular sesuai panduan file-size gate (<400 baris):
  - `src/components/uniform/UniformStockTab.tsx`
  - `src/components/uniform/UniformOrdersTab.tsx`
  - `src/components/uniform/UniformPoTab.tsx`
  - `src/components/uniform/UniformReturnsTab.tsx`

### Decision 2: Mengubah (Bukan Menghapus/Bikin Baru) Modul Retur Eksisting
- **Pilihan**: Mengubah tampilan dan label di `BookReturnsView.tsx` menjadi **Refund Buku**. Menambahkan tombol ekspor CSV laporan refund pada view ini.
- Form publik refund buku (`PublicBookReturnView.tsx`) memanfaatkan alur pencarian siswa (`useStudentSearch`) yang sudah ada dan langsung mengirim payload ke route eksisting `POST /api/student-orders/returns`.
- Endpoint eksisting `POST /api/student-orders/returns/:id/resolve` digunakan dengan aksi `refund` oleh logistik saat meng-approve pengembalian buku.

### Decision 3: Capping Pesanan Paket Cabang Berbasis Data Siswa Aktif
- **Pilihan**: Validasi sisi server pada route pembuatan pesanan internal (`POST /api/school-orders`):
  ```sql
  SELECT COUNT(*) AS total_students FROM students
  WHERE school_id = :schoolId AND grade = :jenjang AND is_active = true
  ```
  Pesanan ditolak dengan status HTTP 422 bila `requested_package_qty > total_students`.

### Decision 4: Alur Surat Jalan dan Bukti Terima Cap Basah
- **Pilihan**: Status pesanan cabang mengadopsi transisi `DRAFT` / `PENDING` -> `PROCESSING` (generate SJ & cetak) -> `DELIVERED_PENDING_PROOF` -> `COMPLETED` (setelah upload foto/scan SJ bertanda tangan & cap basah). File bukti disimpan via storage abstraction (R2/S3).

### Decision 5: Penghapusan Modul Transfer Stok (YAGNI)
- **Pilihan**: Menghapus routing dan navigasi sidebar `transfers` dan memfokuskan seluruh mutasi stok antar-lokasi melalui pesanan cabang dan surat jalan.

### Decision 6: Batasan Tanggung Jawab Gudang pada Beasiswa Parsial
- **Pilihan**: Model `student_book_orders` menyimpan `logistics_discount_pct` dan `logistics_discount_approved_at`. Bila jalur siswa adalah beasiswa parsial, pesanan berstatus `WAITING_DISCOUNT` dan tidak dapat dibayar sampai persentase diinput logistik. Tombol serah terima buku di gudang aktif segera setelah cicilan 1 (`dp_payment`) dan bukti beasiswa diverifikasi (`first_payment_verified = true`).

## Risks / Trade-offs

- **[Risk]** Penghapusan tab transfer dapat memutus link/riwayat transfer lama bila data tidak dapat diakses lagi.
  → **Mitigasi**: Data tabel transfer tetap dipertahankan di database sebagai arsip historis, hanya route navigasi aktif yang dialihkan dan dinonaktifkan dari menu utama.
- **[Risk]** Upload foto bukti fisik SJ dan foto kondisi buku refund dapat membebani penyimpanan storage.
  → **Mitigasi**: Kompresi gambar di sisi browser/client sebelum upload dan batasan ukuran file maksimal 3MB.

## Migration Plan

1. **Skema Database**: Migrasi aditif menambah kolom `received_at` / `handover_at` pada serah terima siswa, kolom diskon logistik & bukti terima pada pesanan internal.
2. **Sinkronisasi D1**: Jalankan `bun run db:generate` dan migrasi ke D1 remote sesuai ADR-0013.
3. **Penyederhanaan UI**: Update navigasi sidebar berdasarkan mapping role baru.
