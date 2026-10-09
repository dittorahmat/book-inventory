# refund-and-vendor-return Specification

## Purpose
Mengelola alur pengembalian dana dan buku (refund) dari orang tua yang diproses di Gudang Pusat serta memfasilitasi retur buku rusak/kelebihan kepada supplier (Return to Vendor).

## Requirements

### Requirement: Penggantian Menu Retur Publik Menjadi Form Pengajuan Refund
Sistem SHALL mengubah formulir publik retur buku rusak menjadi formulir pengajuan refund orang tua dengan verifikasi bahwa proses fisik dan pencairan refund dipusatkan di Gudang Pusat.

#### Scenario: Orang tua mengajukan permohonan refund di form publik
- **WHEN** orang tua mengisi form publik refund dengan memasukkan nomor pesanan siswa, alasan refund, dan rekening/metode pengembalian
- **THEN** sistem mencatat pengajuan refund berstatus `PENDING_REVIEW` dan mengarahkan orang tua untuk verifikasi fisik di Gudang Pusat

### Requirement: Eksekusi Refund Orang Tua di Gudang Pusat Menambah Stok
Sistem SHALL menyediakan modul kasir/admin di Gudang Pusat untuk menyetujui refund orang tua yang mana pengembalian buku fisik layak pakai akan menambah kembali stok buku di Gudang Pusat.

#### Scenario: Admin menyetujui refund buku layak pakai
- **WHEN** admin Gudang Pusat menerima buku fisik dari orang tua, mengonfirmasi kondisi buku baik, dan menyelesaikan transaksi refund
- **THEN** dana dikembalikan ke orang tua, status pesanan diperbarui menjadi `REFUNDED`, dan kuantiti stok buku bertambah 1 di inventaris gudang pusat

### Requirement: Retur Buku ke Supplier (Return to Vendor - RTV)
Sistem SHALL menyediakan modul pengembalian barang ke supplier (kebalikan dari Inbound PO) untuk mengeluarkan stok buku rusak/kelebihan dan menerbitkan nota retur.

#### Scenario: Gudang pusat membuat nota retur supplier
- **WHEN** admin gudang memilih supplier, memilih Purchase Order asal, dan memasukkan 15 eksemplar buku cacat cetak untuk diretur
- **THEN** sistem memotong 15 stok buku dari gudang, menerbitkan dokumen Nota Retur Supplier (RTV), dan mencatat nilai klaim pengembalian dana/potong tagihan supplier
