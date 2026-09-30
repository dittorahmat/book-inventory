## Purpose

Memberi pengguna akses kelola data master supplier langsung dari tab PO tanpa berpindah menu, karena supplier adalah bagian tak terpisahkan dari proses pengadaan.

## ADDED Requirements

### Requirement: Daftar supplier di tab PO
Sistem SHALL menampilkan daftar master supplier (kode, nama, kontak, email, telepon) di dalam tab PO.

#### Scenario: Membuka tab PO
- **WHEN** pengguna membuka tab PO
- **THEN** sistem menampilkan sub-bagian daftar supplier beserta aksi tambah dan ubah

### Requirement: Kelola master supplier
Sistem SHALL mengizinkan tambah dan ubah data supplier dengan validasi kode unik dan format email yang benar.

#### Scenario: Kode supplier duplikat
- **WHEN** pengguna menambah supplier dengan kode yang sudah terdaftar
- **THEN** sistem menolak dengan pesan bahwa kode supplier sudah terdaftar

### Requirement: Supplier dapat dipilih saat membuat PO
Sistem SHALL menyediakan pilihan supplier dari master saat pembuatan PO dan SHALL menampilkan nama supplier pada daftar dan detail PO.

#### Scenario: Membuat PO dari master supplier
- **WHEN** pengguna membuat PO dan memilih supplier dari daftar master
- **THEN** PO tersimpan dengan supplier tersebut dan nama supplier tampil pada daftar PO
