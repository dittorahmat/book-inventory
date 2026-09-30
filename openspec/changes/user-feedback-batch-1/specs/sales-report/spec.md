## Purpose

Memberi gambaran penjualan buku (omzet, penerimaan, piutang) per periode, sekolah, dan tipe paket-versus-satuan sebagai asumsi awal yang akan dikoreksi setelah detail dari user tersedia.

## ADDED Requirements

### Requirement: Rekap penjualan per periode
Sistem SHALL menampilkan rekap penjualan pada rentang tanggal pilihan berisi omzet (total tagihan), terkumpul (total dibayar), piutang (selisih), jumlah order, dan porsi beasiswa yang dicatat terpisah.

#### Scenario: Melihat laporan bulanan
- **WHEN** pengguna memilih rentang satu bulan dan menekan tampilkan
- **THEN** sistem menampilkan omzet, terkumpul, piutang, jumlah order, dan jumlah penerima beasiswa pada periode tersebut

### Requirement: Filter sekolah mengikuti isolasi peran
Sistem SHALL membatasi cakupan laporan mengikuti peran pengguna: central admin dapat memilih semua atau satu sekolah, admin sekolah terkunci pada sekolahnya.

#### Scenario: Admin sekolah membuka laporan
- **WHEN** admin sekolah membuka laporan penjualan
- **THEN** sistem menampilkan data sekolahnya saja tanpa pilihan sekolah lain

### Requirement: Pisah paket dan satuan
Sistem SHALL memisahkan angka penjualan antara order paket dan order satuan (kuantitas dan nilai) dalam laporan yang sama.

#### Scenario: Laporan campuran paket dan satuan
- **WHEN** periode terpilih memuat order paket dan order satuan
- **THEN** sistem menampilkan baris angka terpisah untuk paket dan satuan beserta totalnya

### Requirement: Ekspor CSV
Sistem SHALL menyediakan unduhan laporan dalam format CSV dengan isi yang sama dengan tampilan.

#### Scenario: Mengunduh laporan
- **WHEN** pengguna menekan unduh CSV pada laporan yang sedang tampil
- **THEN** sistem mengunduh berkas CSV berisi data laporan tersebut
