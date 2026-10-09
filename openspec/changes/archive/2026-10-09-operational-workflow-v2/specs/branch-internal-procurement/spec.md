## Purpose

Menstandarisasi alur pengadaan cabang ke gudang pusat berbasis pemesanan unit paket dengan dukungan pemenuhan bertahap melalui multi surat jalan tanpa duplikasi PO.

## ADDED Requirements

### Requirement: Penerbitan PO Internal Cabang Berbasis Paket
Sistem SHALL menyediakan antarmuka bagi admin cabang untuk menerbitkan Purchase Order Internal yang ditujukan ke Gudang Pusat dengan satuan pesanan berupa paket buku (bukan buku satuan).

#### Scenario: Cabang membuat PO paket ke pusat
- **WHEN** admin cabang memesan 50 unit "Paket Kelas 1 SD" dan 40 unit "Paket Kelas 2 SD" ke Gudang Pusat
- **THEN** sistem mencatat PO Internal baru dengan status `PENDING_HQ_APPROVAL` dan mengirim notifikasi ke Gudang Pusat

### Requirement: Pengiriman Bertahap Multi Surat Jalan untuk Satu PO
Gudang Pusat SHALL dapat menerbitkan lebih dari satu Surat Jalan Pengiriman Internal terhadap satu PO Cabang yang sama untuk memenuhi pesanan paket secara bertahap saat sebagian stok buku belum tersedia.

#### Scenario: Gudang pusat mengirim sebagian paket dengan surat jalan pertama
- **WHEN** Gudang Pusat memproses pengiriman 50 paket yang baru memiliki 8 dari 10 buku komponen dengan menerbitkan Surat Jalan #SJ-INT-01
- **THEN** Cabang menerima pengiriman tahap 1, status PO Cabang tercatat `PARTIALLY_DELIVERED`, dan sistem mencatat 2 buku x 50 unit sebagai outstanding pengiriman pusat

#### Scenario: Gudang pusat mengirim susulan sisa buku dengan surat jalan kedua
- **WHEN** 2 buku yang tertunda telah tiba di pusat dan Gudang Pusat menerbitkan Surat Jalan #SJ-INT-02 pelunasan untuk PO yang sama
- **THEN** Cabang menerima pengiriman tahap 2 dan status pemenuhan PO otomatis berubah menjadi `COMPLETED` tanpa cabang perlu membuat PO kedua
