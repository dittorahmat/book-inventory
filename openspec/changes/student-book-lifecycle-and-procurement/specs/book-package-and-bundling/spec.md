## Purpose

Mengelola katalog paket buku dan komponen buku satuan (BOM), serta memfasilitasi transaksi perakitan stok paket (assembly/bundling) dan pembongkaran paket kembali ke stok satuan (disassembly/unbundling) secara konsisten dan transaksional.

## ADDED Requirements

### Requirement: Master Data Buku Satuan dan Paket
Sistem SHALL menyediakan pengelolaan data buku satuan (ISBN, judul, penerbit, jenjang, kategori lokal/internasional) dan master paket buku (nama paket, kelas/tingkat, tahun ajaran, kurikulum, harga paket) beserta daftar komponen buku penyusunnya.

#### Scenario: Menambahkan paket buku baru dengan komponen buku satuan
- **WHEN** Admin membuat paket baru "Paket Kelas 1 SD Internasional" dan mendaftarkan 12 buku satuan berbeda sebagai komponen
- **THEN** Sistem menyimpan paket dan menghubungkan relasi BOM 12 buku komponen dengan quantity masing-masing

### Requirement: Perakitan Paket Buku (Bundling / Kitting)
Sistem SHALL menyediakan operasi perakitan stok paket yang secara transaksional mengurangi jumlah stok fisik buku satuan yang tersedia dan menambah jumlah stok paket siap serah.

#### Scenario: Perakitan paket berhasil saat stok satuan mencukupi
- **WHEN** Admin logistik menginput perakitan 20 unit "Paket Kelas 1 SD Internasional" dan semua 12 buku satuan memiliki stok loose >= 20
- **THEN** Sistem mengurangi 20 unit dari setiap buku satuan komponen, menambah 20 unit stok paket siap serah, dan mencatat riwayat transaksi bundling

#### Scenario: Perakitan paket gagal saat stok salah satu komponen tidak mencukupi
- **WHEN** Admin logistik menginput perakitan 20 unit paket tetapi stok salah satu buku satuan hanya tersedia 15
- **THEN** Sistem membatalkan transaksi, menampilkan error kekurangan stok buku satuan yang spesifik, dan tidak mengubah saldo stok apapun

### Requirement: Pembongkaran Paket Buku (Unbundling / De-kitting)
Sistem SHALL menyediakan operasi pembongkaran stok paket jadi yang secara transaksional mengurangi jumlah stok paket siap serah dan mengembalikan seluruh buku satuan penyusunnya ke stok satuan (loose stock).

#### Scenario: Pembongkaran paket berhasil
- **WHEN** Admin logistik membongkar 5 unit "Paket Kelas 1 SD Internasional" dengan alasan alokasi penggantian buku retur
- **THEN** Sistem mengurangi 5 unit stok paket, menambah 5 unit ke masing-masing 12 buku satuan komponen di stok satuan, dan mencatat log alasan pembongkaran
