## Purpose

Menyediakan data demo realistis berupa 4 sekolah Al Wildan, katalog buku berstandar kurikulum Cambridge, serta sebaran unit fisik dan riwayat pergerakan transfer antarsekolah.

## ADDED Requirements

### Requirement: Inisialisasi Data Demo 4 Sekolah Al Wildan
Sistem HARUS menyediakan endpoint/prosedur otomatis untuk menginisialisasi 4 entitas sekolah: Al Wildan 1 (HQ Pusat) dan Al Wildan 2, 3, 4 (Cabang).

#### Scenario: Pemicuan seed demo sekolah
- **WHEN** Administrator atau pengembang memicu pemuatan data demo
- **THEN** Sistem mendaftarkan 1 sekolah utama (HQ) dan 3 sekolah cabang dengan identitas alamat dan kode unik yang valid

### Requirement: Katalog Buku Cambridge dan Eksemplar Ber-Barcode
Sistem HARUS memuat katalog buku kurikulum Cambridge beserta puluhan unit eksemplar fisik dengan nomor barcode unik yang terdistribusi di keempat sekolah Al Wildan.

#### Scenario: Menampilkan koleksi buku Cambridge di inventaris
- **WHEN** Pengguna membuka katalog buku atau inventaris sekolah
- **THEN** Koleksi buku kurikulum Cambridge ditampilkan lengkap dengan nomor ISBN, kategori, dan status unit fisik di masing-masing sekolah
