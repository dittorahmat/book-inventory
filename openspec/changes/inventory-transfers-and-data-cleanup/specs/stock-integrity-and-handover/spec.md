## Purpose

Menjaga integritas data stok buku satuan saat perakitan dan pembongkaran paket, serta memastikan serah terima buku ke siswa memvalidasi ketersediaan stok fisik secara fail-closed.

## ADDED Requirements

### Requirement: Integritas Perhitungan Total Stok Satuan saat Unbundle
Sistem SHALL menghitung kuantitas total stok fisik (`totalQty`) hanya dari eksemplar buku yang aktif dan tidak berstatus `disposed`. Pembongkaran paket buku tidak boleh menyebabkan penggandaan atau distorsi angka rasio stok pada tampilan ringkasan stok.

#### Scenario: Memeriksa ringkasan stok setelah pembongkaran paket
- **WHEN** 10 buku satuan dirakit menjadi 5 paket (diserap) lalu 5 paket tersebut dibongkar kembali
- **THEN** total buku satuan (`totalQty`) dan buku tersedia (`availableQty`) pada ringkasan stok menunjukkan nilai aktual 10/10 (bukan 10/20)

### Requirement: Validasi Ketersediaan Stok Sebelum Serah Terima (Fail-Closed)
Sistem SHALL memvalidasi ketersediaan fisik paket buku atau buku satuan di cabang terkait sebelum memperbarui status pesanan menjadi `picked_up`. Jika stok fisik tidak mencukupi (kuantitas 0), sistem SHALL menolak permintaan dengan status HTTP 400 dan pesan kesalahan yang jelas.

#### Scenario: Serah terima saat stok paket kosong
- **WHEN** staf sekolah memproses serah terima paket buku untuk pesanan siswa, namun tidak ada bundel paket fisik yang berstatus `in_stock` di cabang tersebut
- **THEN** sistem menolak serah terima dengan respons HTTP 400 bertuliskan pesan bahwa stok tidak mencukupi di cabang ini, dan status pesanan siswa tetap tidak berubah

#### Scenario: Serah terima saat stok paket tersedia
- **WHEN** staf memproses serah terima dan terdapat bundel paket `in_stock`
- **THEN** sistem mengalokasikan bundel tersebut, memperbarui status bundel menjadi `delivered`, dan mengubah status pesanan menjadi `picked_up`

### Requirement: Kelengkapan Pilihan Kelas di Form Portal
Formulir pencarian dan pendaftaran siswa pada portal publik SHALL menyediakan pilihan tingkat kelas lengkap dari Kelas 1 hingga Kelas 12.

#### Scenario: Pengguna memilih tingkat kelas di formulir portal
- **WHEN** pengguna membuka dropdown pilihan kelas masuk siswa di portal
- **THEN** daftar dropdown menampilkan opsi Kelas 1 SD hingga Kelas 12 SMA secara lengkap
