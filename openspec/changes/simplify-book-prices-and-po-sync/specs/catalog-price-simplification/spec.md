## Purpose

Menyederhanakan antarmuka form harga buku di katalog dengan hanya menampilkan Harga Beli dan Harga Jual, serta mengeliminasi kebingungan atas input Harga Dasar.

## ADDED Requirements

### Requirement: Tampilan harga buku di form katalog disederhanakan
Sistem HARUS menampilkan hanya dua field input harga buku pada form penambahan dan pengubahan katalog: "Harga Beli (Rp)" dan "Harga Jual (Rp)", serta menghapus tampilan input "Harga Dasar (Rp)".

#### Scenario: Form katalog hanya menampilkan harga beli dan harga jual
- **WHEN** pengguna membuka form tambah buku baru atau form edit buku di katalog
- **THEN** antarmuka hanya menampilkan input untuk Harga Beli (Rp) dan Harga Jual (Rp) tanpa input Harga Dasar (Rp)

### Requirement: Sinkronisasi nilai legacy price otomatis
Sistem HARUS secara otomatis mengisi nilai kolom kompatibilitas legacy `price` saat buku dibuat atau diubah, menggunakan nilai `sellPrice` atau fallback `buyPrice` jika `sellPrice` tidak diisi.

#### Scenario: Nilai legacy price tersinkron saat menyimpan buku
- **WHEN** pengguna menyimpan buku baru dengan Harga Beli Rp 50.000 dan Harga Jual Rp 75.000
- **THEN** payload buku yang dikirimkan ke backend tetap memiliki field `price` bernilai 75.000 sehingga kompatibel dengan endpoint API katalog
