## Purpose

Mencerminkan kesepakatan diskon volume dengan supplier pada tiap item PO dalam persen, lengkap dengan total sebelum dan sesudah diskon.

## ADDED Requirements

### Requirement: Diskon persen per item PO
Sistem SHALL mengizinkan tiap item PO memiliki diskon dalam persen (0–100) yang mencerminkan kesepakatan dengan supplier, dan SHALL menghitung harga netto per item sebagai `quantity * unitPrice * (1 - discountPercent/100)`.

#### Scenario: Membuat PO dengan diskon item
- **WHEN** pengguna membuat PO dengan satu item berkuantitas 100, harga satuan 50000, dan diskon 10 persen
- **THEN** sistem menyimpan diskon 10 persen dan menghitung netto item 4500000

#### Scenario: Diskon nol sama dengan tanpa diskon
- **WHEN** pengguna membuat item PO tanpa mengisi diskon
- **THEN** sistem memperlakukannya sebagai diskon 0 persen dan netto sama dengan subtotal kotor

### Requirement: Total PO tiga angka
Sistem SHALL menampilkan dan menyimpan tiga angka pada tiap PO: total kotor sebelum diskon, total nilai diskon, dan total netto setelah diskon.

#### Scenario: Melihat ringkasan total PO
- **WHEN** pengguna membuka detail PO dengan beberapa item berdiskon berbeda
- **THEN** sistem menampilkan total kotor, total diskon, dan total netto yang konsisten dengan penjumlahan tiap item

### Requirement: Validasi rentang diskon
Sistem SHALL menolak diskon negatif atau di atas 100 persen dengan pesan yang jelas.

#### Scenario: Diskon melebihi 100 persen
- **WHEN** pengguna memasukkan diskon 150 persen pada item PO
- **THEN** sistem menolak penyimpanan dan menampilkan pesan kesalahan validasi
