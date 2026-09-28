## Purpose

Memungkinkan admin HQ mengirim Purchase Order pengadaan buku langsung ke email supplier dari modul Pengadaan, dengan bukti kirim yang tercatat di sistem.

## ADDED Requirements

### Requirement: Pengiriman PO ke email supplier

Sistem SHALL menyediakan aksi kirim PO ke alamat email supplier yang terdaftar, mencatat waktu dan tujuan pengiriman, serta mengizinkan kirim ulang.

#### Scenario: Kirim PO pertama kali

- **WHEN** admin HQ menekan "Kirim PO" pada PO berstatus `ordered` yang suppliernya memiliki email valid
- **THEN** sistem mengirim email PO ke alamat tersebut, mengubah status PO menjadi `sent`, dan mencatat `sentAt` serta `sentTo`

#### Scenario: Kirim ulang PO

- **WHEN** admin HQ menekan "Kirim Ulang" pada PO yang sudah pernah dikirim
- **THEN** sistem mengirim ulang email PO ke alamat email supplier saat ini dan memperbarui `sentAt` serta `sentTo`

#### Scenario: Supplier tanpa email valid

- **WHEN** admin HQ mencoba mengirim PO yang suppliernya tidak memiliki alamat email valid
- **THEN** sistem menolak pengiriman dengan pesan "Email supplier belum diisi / tidak valid" dan status PO tidak berubah

#### Scenario: Status pengiriman jujur di daftar PO

- **WHEN** daftar PO ditampilkan setelah upaya pengiriman
- **THEN** setiap PO menampilkan status pengiriman yang benar: `Terkirim`, `Simulasi (tidak benar-benar terkirim)`, atau `Gagal` beserta alasannya

### Requirement: Isi email PO

Email PO yang dikirim SHALL memuat identitas PO yang cukup bagi supplier untuk memproses pesanan: nomor PO, tanggal order, sekolah tujuan, daftar buku (judul, ISBN, jumlah), total estimasi, dan catatan.

#### Scenario: Supplier menerima email lengkap

- **WHEN** email PO terkirim ke supplier
- **THEN** email memuat nomor PO, tanggal order, nama sekolah tujuan, daftar item buku beserta jumlahnya, total estimasi pembelian, dan catatan PO bila ada

### Requirement: Pengiriman tidak mengganggu receiving

Pengiriman email PO SHALL NOT mengubah jumlah `quantityOrdered`, `quantityReceived`, atau stok `book_items`; alur receiving (`ordered` → `partially_received` → `received`) tetap berjalan seperti semula.

#### Scenario: Receiving setelah PO dikirim

- **WHEN** barang dari PO berstatus `sent` diterima di gudang
- **THEN** sistem mencatat penerimaan dan memperbarui status menjadi `partially_received` atau `received` sesuai kelengkapan, tanpa menghapus jejak `sentAt`/`sentTo`
