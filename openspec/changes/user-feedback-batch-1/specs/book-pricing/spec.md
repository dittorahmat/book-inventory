## Purpose

Memisahkan harga beli dan harga jual pada tiap buku serta menjadikan harga paket sebagai hasil penjumlahan harga satuan penyusunnya agar selalu konsisten.

## ADDED Requirements

### Requirement: Harga beli dan harga jual per buku
Sistem SHALL menyimpan dua harga pada tiap buku: harga beli (acuan pengadaan) dan harga jual (acuan paket dan penjualan), keduanya bilangan bulat non-negatif dalam rupiah.

#### Scenario: Membuat buku dengan dua harga
- **WHEN** pengguna membuat buku dengan harga beli 40000 dan harga jual 55000
- **THEN** sistem menyimpan kedua harga dan menampilkannya pada daftar dan detail buku

#### Scenario: Buku lama tanpa harga terpisah
- **WHEN** sistem membaca buku lama yang hanya memiliki satu harga
- **THEN** kedua harga diperlakukan terisi dari harga lama tersebut sampai pengguna memperbaruinya

### Requirement: Harga paket terkomputasi dari harga satuan
Sistem SHALL menghitung total harga paket sebagai jumlah `harga jual satuan * kuantitas` seluruh komponennya, dan SHALL memperbarui total paket setiap kali komposisi paket atau harga jual komponen berubah.

#### Scenario: Merakit paket menghitung total otomatis
- **WHEN** pengguna menyusun paket dari dua buku berharga jual 30000 dan 50000 masing-masing satu eksemplar
- **THEN** sistem menetapkan harga paket 80000 tanpa input manual

#### Scenario: Harga buku berubah memperbarui paket
- **WHEN** pengguna mengubah harga jual sebuah buku yang dipakai tiga paket
- **THEN** sistem menghitung ulang harga ketiga paket tersebut

### Requirement: Harga beli sebagai default harga PO
Sistem SHALL mengisi awal harga satuan item PO dari harga beli buku terkait, tetap dapat diubah manual per PO (misalnya karena negosiasi dan diskon).

#### Scenario: Membuat item PO mengambil harga beli
- **WHEN** pengguna menambah buku ke PO
- **THEN** kolom harga satuan terisi otomatis dari harga beli buku dan dapat disunting
