# Spec Delta

## Purpose

Mengelola tata kelola inventori seragam secara mandiri (katalog, ukuran, stok per cabang/pusat, pesanan cabang, PO vendor, dan retur) dengan isolasi modul dan hak akses terpisah dari gudang buku.

## ADDED Requirements

### Requirement: Isolasi Navigasi dan Hak Akses Modul Seragam
Sistem SHALL menyediakan hak akses khusus dan isolasi antarmuka untuk staf seragam sehingga admin gudang seragam hanya dapat melihat dan mengakses modul seragam, sedangkan admin gudang buku hanya mengakses modul buku.

#### Scenario: Admin seragam login ke sistem
- **WHEN** pengguna dengan peran admin gudang seragam masuk ke sistem
- **THEN** sistem hanya menampilkan modul inventori seragam dan menyembunyikan modul gudang buku serta transfer buku

#### Scenario: Admin buku login ke sistem
- **WHEN** pengguna dengan peran admin gudang buku masuk ke sistem
- **THEN** sistem hanya menampilkan modul buku dan menyembunyikan modul seragam

### Requirement: Restrukturisasi Tampilan Modul Gudang Seragam
Sistem SHALL menyediakan tata kelola multi-tab komprehensif pada modul seragam yang mencakup tab Katalog & Stok, Pesanan Seragam, Pengadaan PO Vendor, serta Retur/Refund Seragam.

#### Scenario: Mengakses navigasi modular seragam
- **WHEN** admin seragam membuka modul seragam
- **THEN** sistem menyajikan navigasi tab terpisah untuk Katalog/Stok, Pesanan, PO Vendor, dan Retur tanpa menumpuk semua fungsionalitas dalam satu tampilan halaman

### Requirement: Pembatasan Akses Cabang untuk Seragam
Sistem SHALL menyederhanakan hak akses pengguna cabang sehingga hanya dapat melihat pesanan seragam yang relevan dengan cabangnya tanpa akses ke konfigurasi global pusat.

#### Scenario: Staf cabang mengakses modul seragam
- **WHEN** admin cabang membuka antarmuka seragam
- **THEN** antarmuka terbatasi pada permohonan pesanan seragam cabang dan status distribusi seragam siswa cabang tersebut
