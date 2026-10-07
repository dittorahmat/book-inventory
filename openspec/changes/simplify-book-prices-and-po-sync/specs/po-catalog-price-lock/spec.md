## Purpose

Mengotomatiskan pengisian harga satuan buku pada Purchase Order (PO) langsung dari harga beli katalog dan mengunci field harga satuan agar berstatus read-only.

## ADDED Requirements

### Requirement: Sinkronisasi otomatis harga satuan saat judul buku dipilih
Sistem HARUS memperbarui nilai `unitPrice` pada baris item PO secara otomatis mengikuti harga beli (`effectiveBookPrice.buy`) dari buku yang dipilih di katalog setiap kali pengguna memilih atau mengubah judul buku.

#### Scenario: Pemilihan buku memperbarui harga satuan
- **WHEN** pengguna memilih judul buku tertentu pada dropdown item PO
- **THEN** field Harga Satuan (Rp) pada baris tersebut otomatis terisi dengan nilai harga beli efektif buku tersebut dari katalog

#### Scenario: Penambahan baris item PO baru
- **WHEN** pengguna menekan tombol "Tambah Judul Buku" pada modal PO
- **THEN** baris baru langsung memiliki Harga Satuan (Rp) yang sesuai dengan harga beli buku pertama/default yang terpilih

### Requirement: Kolom harga satuan pada PO terkunci read-only
Sistem HARUS mengunci field input Harga Satuan (Rp) pada formulir pembuatan PO sehingga berstatus read-only dan tidak dapat diubah secara bebas oleh pengguna secara manual.

#### Scenario: Input harga satuan tidak dapat diedit langsung
- **WHEN** pengguna melihat kolom Harga Satuan (Rp) di modal pembuatan PO
- **THEN** field input tersebut berstatus read-only dengan indikator visual non-editable (latar belakang sedikit abu-abu/disabled) dan nilainya konsisten dengan katalog
