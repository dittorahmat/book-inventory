# Proposal

## Why

Operasional gudang pusat dan cabang saat ini masih memiliki friksi koordinasi: menu navigasi cabang terlalu kompleks, modul seragam masih menyatu dalam satu tab padat tanpa struktur gudang profesional, proses pesanan buku cabang belum terikat dengan surat jalan (SJ) serah terima fisik ber-cap basah, pesanan cabang belum dibatasi kuota siswa riil, serta modul transfer stok lama menjadi redundan (YAGNI). Selain itu, fitur retur buku yang sudah ada saat ini (`BookReturnsView.tsx` dan `book_returns`) perlu dirombak menjadi **Refund Buku** yang langsung ditangani gudang logistik dengan form publik pencarian siswa, pencatatan tanggal penerimaan buku siswa, serta penegasan batas tanggung jawab gudang pada pembayaran beasiswa parsial (hanya pada cicilan pertama).

Perubahan ini merapikan RBAC, menyederhanakan alur logistik, memisahkan modul seragam menjadi modul gudang mandiri, memanfaatkan serta merombak fitur retur yang sudah ada menjadi refund buku terpadu, dan memperkuat akuntabilitas serah terima barang antara pusat, cabang, dan wali murid.

## What Changes

- **Pemisahan Modul Gudang Buku dan Seragam (RBAC & UI)**:
  - Admin Gudang Buku hanya dapat melihat modul Gudang Buku.
  - Admin Gudang Seragam hanya dapat melihat modul Seragam. Modul seragam dirombak dari 1 tab padat menjadi struktur gudang multi-tab (Katalog & Stok, Pesanan, PO Vendor, Retur/Refund).
  - Admin Cabang (Sekolah) disederhanakan: hanya dapat mengakses tab **Pesan ke Gudang** dan **Data Siswa**.
  - Admin Gudang Pusat dapat melihat seluruh data siswa (HQ + Cabang) dengan filter dropdown per cabang.
- **Revamp "Pesan ke Gudang" / "Pesanan dari Cabang"**:
  - Label dinamis: *Pesan ke Gudang* (di sisi Cabang) dan *Pesanan dari Cabang* (di sisi Gudang Pusat).
  - Validasi capping kuota: Jumlah pesanan paket buku ke gudang dibatasi maksimal sejumlah total siswa aktif cabang pada jenjang tersebut.
  - Tektokan & Surat Jalan: Tombol **Proses** di Gudang Pusat langsung membuka/mencetak Surat Jalan (SJ). Cabang melakukan serah terima fisik lalu mengunggah scan/foto SJ bertanda tangan & cap basah sebagai Bukti Terima resmi.
  - **BREAKING**: Menghapus modul/tab Transfer Stok lama yang redundan (prinsip YAGNI).
- **Penerimaan Buku Siswa**:
  - Menampilkan dan mencatat tanggal aktual penerimaan buku pada tab/tabel penerimaan siswa.
- **Skema Beasiswa Parsial & Tanggung Jawab Gudang**:
  - Logistik memasukkan persentase diskon beasiswa parsial. Tagihan final belum terbit sebelum diskon diinput oleh logistik.
  - Siswa beasiswa parsial dapat membayar bertahap (cicilan). Gudang hanya bertanggung jawab merilis barang pada pembayaran pertama (DP) dengan verifikasi bukti bayar cicilan 1 dan bukti SK beasiswa. Cicilan berikutnya di luar tanggung jawab gudang.
- **Revamp Modul Retur Menjadi Refund Buku (Reuse Eksisting)**:
  - Mengubah terminologi tab dari `Retur Buku` menjadi `Refund Buku` di [`src/views/BookReturnsView.tsx`](file:///D:/development/book-inventory/src/views/BookReturnsView.tsx) dan menyesuaikan alurnya langsung dikembalikan ke Gudang Logistik.
  - Menyediakan kembali form publik refund buku (`PublicBookReturnView.tsx`) dengan alur mirip pemesanan: pilih Cabang -> cari NIS atau Nama Siswa -> otomatis memuat buku yang pernah diterima -> pilih buku & nominal refund -> upload foto bukti kondisi fisik buku -> menembak API eksisting `POST /api/student-orders/returns`.
  - Mengubah aksi penanganan di [`BookReturnsView.tsx`](file:///D:/development/book-inventory/src/views/BookReturnsView.tsx) menjadi checklist approval logistik per item refund.
  - Menambahkan fitur ekspor/download rekap data refund yang diapprove (filter cabang, jenjang, rentang tanggal) untuk diteruskan secara manual ke tim Finance.

## Capabilities

### New Capabilities
- `uniform-warehouse-management`: Tata kelola mandiri inventori seragam (stok, varian, pesanan cabang, PO vendor, dan retur) dengan isolasi modul dan hak akses terpisah dari gudang buku.

### Modified Capabilities
- `refund-and-vendor-return`: Merombak alur retur buku eksisting menjadi refund buku gudang, menambahkan form publik pencarian siswa, approval checklist logistik pada data `book_returns`, dan ekspor laporan ke Finance.
- `branch-internal-procurement`: Penyesuaian alur pesanan cabang ke gudang dengan pembatasan kuota berbasis jumlah siswa per jenjang, integrasi cetak Surat Jalan (SJ) saat proses, dan upload bukti terima fisik bertanda tangan & cap basah.
- `finance-discretion-and-partial-payment`: Penambahan persentase diskon beasiswa parsial oleh tim logistik sebelum tagihan final keluar, serta pembatasan tanggung jawab rilis gudang hanya pada pembayaran cicilan pertama.
- `student-data-management`: Penambahan field/pelacakan tanggal penerimaan buku siswa dan hak akses admin gudang pusat untuk melihat data siswa seluruh cabang dengan filter.

## Impact

- **UI / Navigation**: Restrukturisasi navigasi sidebar dan tab berdasarkan role (Admin Cabang, Admin Gudang Buku, Admin Gudang Seragam). Penghapusan link/halaman transfer stok. Mengubah tab `Retur Buku` menjadi `Refund Buku`.
- **Database / Schema**: Memanfaatkan tabel `book_returns` eksisting, menambah field pelacakan tanggal penerimaan buku siswa, relasi bukti terima SJ bertanda tangan di pesanan cabang, serta kolom diskon beasiswa logistik.
- **API Routes**: Menggunakan router eksisting `src/server/routes/student-orders.ts` untuk refund buku publik, approval logistik, dan export CSV; endpoint pesanan cabang diperluas untuk capping kuota, generate SJ, dan upload bukti terima.
