## Purpose

Membatasi operasional perakitan paket buku hanya di Gudang Pusat, mengakomodasi perakitan paket berstatus parsial (dengan outstanding backorder), serta melayani penjualan buku satuan langsung ke orang tua siswa.

## ADDED Requirements

### Requirement: Perakitan Paket Eksklusif di Gudang Pusat
Sistem SHALL membatasi hak akses aksi perakitan paket (kit assembly) hanya untuk staf/admin Gudang Pusat dan menonaktifkan fitur perakitan mandiri di cabang.

#### Scenario: Cabang tidak dapat mengakses fitur rakit paket
- **WHEN** pengguna login dengan peran admin cabang membuka modul inventaris
- **THEN** menu atau aksi untuk merakit paket buku tidak ditampilkan atau diblokir oleh otorisasi sistem

### Requirement: Perakitan Paket dengan Status Kelengkapan Parsial
Sistem SHALL mendukung perakitan paket buku meskipun terdapat komponen buku yang stoknya belum lengkap, dengan menandai paket sebagai `PARTIAL_ASSEMBLY` dan mencatat daftar buku yang berstatus outstanding.

#### Scenario: Gudang merakit paket saat 2 dari 10 buku belum ada
- **WHEN** staf gudang merakit 10 paket Kelas 1 di mana stok buku ke-9 dan ke-10 sedang kosong di gudang
- **THEN** sistem mengunci 8 buku fisik per paket yang ada, menerbitkan 10 paket berstatus `PARTIAL_ASSEMBLY`, dan mencatat saldo hutang buku perakitan sejumlah 20 eksemplar

### Requirement: Penjualan Buku Satuan Langsung ke Orang Tua di Gudang Pusat
Sistem SHALL menyediakan antarmuka kasir penjualan langsung (POS) di Gudang Pusat yang melayani pembelian buku satuan oleh orang tua murid dan langsung memotong stok satuan gudang.

#### Scenario: Orang tua membeli buku satuan pengganti yang hilang
- **WHEN** kasir gudang pusat menginput pembelian 1 eksemplar buku Matematika Kelas 4 oleh orang tua dan menerima pembayaran lunas
- **THEN** sistem menerbitkan struk penjualan, menambah kas pendapatan, dan memotong 1 unit stok buku satuan di Gudang Pusat
