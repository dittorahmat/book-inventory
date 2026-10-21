# Spec Delta: push-distribution-management

## Purpose
Mengatur kapabilitas distribusi dorong (push distribution) satu arah dari Gudang Pusat ke sekolah/cabang pada awal tahun ajaran berbasis kuota maksimal siswa (Cap Max) per jenjang dan kelas tanpa memerlukan pembuatan Purchase Order (PO) internal terlebih dahulu oleh cabang.

## ADDED Requirements

### Requirement: Kalkulasi Cap Max Alokasi Siswa Cabang
Sistem SHALL menyediakan antarmuka kalkulasi kuota distribusi buku bagi staf/admin Gudang Pusat yang menghitung jumlah siswa terdaftar per jenjang/kelas di masing-masing cabang untuk menentukan batas maksimal kuota kirim (Cap Max).

#### Scenario: Gudang Pusat melihat rekomendasi alokasi distribusi cabang
- **WHEN** admin Gudang Pusat membuka modul Push Distribution dan memilih cabang target beserta tahun ajaran
- **THEN** sistem menampilkan rekapitulasi jumlah siswa terdaftar per jenjang dan merekomendasikan jumlah paket buku yang harus dikirimkan sesuai kuota siswa

### Requirement: Penerbitan Surat Jalan Distribusi Massal Satu Arah
Gudang Pusat SHALL dapat menerbitkan Surat Jalan (SJ) distribusi internal langsung ke cabang tanpa adanya Purchase Order (PO) sebelumnya dari cabang.

#### Scenario: Gudang Pusat mengirimkan stok awal tahun ajaran ke cabang
- **WHEN** admin Gudang Pusat mengonfirmasi pengiriman bulk push distribution untuk cabang target
- **THEN** sistem menerbitkan Surat Jalan Distribusi Internal, memotong stok paket di Gudang Pusat, dan mencatat pengiriman dalam status `IN_TRANSIT` menuju cabang

#### Scenario: Cabang mengonfirmasi penerimaan stok bulk
- **WHEN** staf cabang menerima fisik buku dan menekan tombol konfirmasi penerimaan Surat Jalan
- **THEN** sistem menambahkan stok paket ke inventaris cabang dan menandai Surat Jalan sebagai `RECEIVED`
