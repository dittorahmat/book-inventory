## Purpose

Mengelola siklus pengadaan buku dari supplier melalui dokumen Purchase Order (PO), pelacakan status pengiriman supplier, dan pencatatan penerimaan barang masuk ke dalam stok buku satuan (loose inventory).

## ADDED Requirements

### Requirement: Pembuatan dan Pengiriman Purchase Order (PO)
Sistem SHALL menyediakan pembuatan dokumen PO ke supplier resmi dengan daftar buku satuan yang dipesan, kuantitas, harga kesepakatan, dan estimasi waktu pengiriman.

#### Scenario: Pembuatan draft PO baru ke supplier
- **WHEN** Admin pengadaan memilih supplier "Penerbit Erlangga", menambahkan item buku "Pendidikan Agama Islam 1" sebanyak 500 eksamplar, dan menyimpan PO
- **THEN** Sistem menerbitkan nomor PO unik berstatus "draft" dengan total nilai pemesanan yang terkalkulasi otomatis

### Requirement: Penerimaan Barang Masuk (Inbound Receiving)
Sistem SHALL mencatat penerimaan barang fisik dari supplier berdasarkan nomor PO, mendukung penerimaan parsial maupun penuh, dan secara otomatis menambah saldo stok satuan pada sekolah/gudang tujuan.

#### Scenario: Penerimaan barang penuh sesuai PO
- **WHEN** Petugas gudang memverifikasi kiriman supplier tiba dan mengonfirmasi penerimaan 500 eksamplar sesuai PO
- **THEN** Sistem memperbarui status PO menjadi "completed", mencatat tanggal penerimaan, dan menambah 500 unit ke stok satuan buku di gudang sekolah
