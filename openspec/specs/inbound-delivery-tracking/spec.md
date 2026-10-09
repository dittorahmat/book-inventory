# inbound-delivery-tracking Specification

## Purpose
Mencatat nomor surat jalan fisik supplier dan mendukung riwayat penerimaan barang secara parsial/bertahap pada Purchase Order pengadaan buku.

## Requirements

### Requirement: Input Nomor Surat Jalan Supplier pada Inbound
Sistem SHALL mewajibkan petugas gudang memasukkan nomor surat jalan fisik dari pengirim/supplier serta tanggal terima pada setiap sesi penerimaan barang (inbound receipt).

#### Scenario: Petugas gudang mencatat surat jalan saat terima barang
- **WHEN** petugas gudang mengonfirmasi penerimaan barang dengan nomor surat jalan "SJ-SUP-2026-091" dan kuantiti buku yang datang
- **THEN** sistem menyimpan log penerimaan terkait nomor surat jalan tersebut dan menambah stok fisik gudang

#### Scenario: Validasi surat jalan wajib diisi
- **WHEN** petugas mencoba menyimpan penerimaan barang tanpa memasukkan nomor surat jalan supplier
- **THEN** sistem menolak penerimaan dengan pesan kesalahan bahwa nomor surat jalan wajib diisi

### Requirement: Penerimaan Barang Bertahap / Parsial
Sistem SHALL mendukung penerimaan parsial dari satu Purchase Order di mana tiap batch pengiriman mencatat judul buku dan kuantiti yang tiba serta menghitung sisa barang yang belum dikirim.

#### Scenario: Penerimaan sebagian kuantiti PO
- **WHEN** supplier mengirimkan 30 dari 100 eksemplar buku A pada pengiriman pertama dengan surat jalan SJ-01
- **THEN** status PO berubah menjadi `PARTIAL_RECEIVED`, kuantiti diterima bertambah 30, dan sisa outstanding PO tercatat 70 unit

#### Scenario: Penyelesaian penerimaan PO
- **WHEN** supplier mengirimkan sisa 70 eksemplar buku A pada pengiriman kedua dengan surat jalan SJ-02
- **THEN** status PO diperbarui menjadi `COMPLETED` dan riwayat menampilkan kedua sesi penerimaan surat jalan secara transparan
