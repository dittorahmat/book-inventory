## Purpose

Menghilangkan noise ID fisik per eksemplar dari seluruh tampilan dan alur utama; pengguna bekerja dengan ringkasan per judul/paket dan kuantitas, sistem yang mengalokasikan fisiknya.

## ADDED Requirements

### Requirement: Stok satuan tampil per judul
Sistem SHALL menampilkan stok satuan sebagai satu baris per judul buku per lokasi berisi kuantitas total dan ringkasan kondisi, tanpa menampilkan daftar barcode per eksemplar pada tampilan utama.

#### Scenario: Membuka stok satuan
- **WHEN** pengguna membuka halaman stok satuan di suatu lokasi
- **THEN** sistem menampilkan satu baris per judul dengan kuantitas dan ringkasan kondisinya

### Requirement: Stok paket tampil per paket
Sistem SHALL menampilkan stok paket sebagai satu baris per jenis paket per lokasi berisi kuantitas dan ringkasan status, tanpa menampilkan kode fisik tiap bundel pada tampilan utama.

#### Scenario: Membuka stok paket
- **WHEN** pengguna membuka halaman stok paket di suatu lokasi
- **THEN** sistem menampilkan satu baris per jenis paket dengan kuantitas dan ringkasan statusnya

### Requirement: Ringkasan stok di dashboard
Sistem SHALL menampilkan ringkasan stok satuan dan paket (kuantitas per judul/paket termasuk sebaran status dan kondisi) pada dashboard sesuai lokasi pengguna.

#### Scenario: Dashboard admin sekolah
- **WHEN** admin sekolah membuka dashboard
- **THEN** sistem menampilkan ringkasan stok lokasi sekolahnya saja tanpa detail fisik

### Requirement: Transaksi berbasis kuantitas dengan auto-alokasi
Sistem SHALL menerima input transaksi stok (transfer, penerimaan, serah terima, penggantian retur) dalam bentuk kuantitas per judul/paket, dan SHALL mengalokasikan eksemplar fisik secara otomatis (FIFO) tanpa pengguna memilih ID fisik.

#### Scenario: Membuat transfer tanpa pilih barcode
- **WHEN** pengguna membuat transfer berisi 10 eksemplar suatu judul
- **THEN** sistem mencatat transfer 10 kuantitas dan mengalokasikan 10 eksemplar fisik tertua secara otomatis

#### Scenario: Surat jalan dengan banyak paket
- **WHEN** pengguna membuat satu surat jalan berisi beberapa jenis paket sekaligus
- **THEN** sistem mencatat satu dokumen dengan baris-baris kuantitas per jenis paket, bukan daftar kode fisik

### Requirement: Status satuan tidak berubah karena bundling saat transfer
Sistem SHALL menjaga status eksemplar satuan yang sudah dibundling agar tidak berubah atau berpindah lokasi hanya karena paketnya ditransfer; yang berpindah adalah paketnya.

#### Scenario: Transfer paket hasil bundling
- **WHEN** paket hasil bundling ditransfer ke lokasi lain
- **THEN** status eksemplar satuan penyusunnya tetap seperti sebelum transfer dan hanya lokasi paket yang berubah
