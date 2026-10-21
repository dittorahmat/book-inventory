# Spec Delta: branch-internal-procurement

## MODIFIED Requirements

### Requirement: Penerbitan PO Internal Cabang Berbasis Paket
Sistem SHALL menyediakan antarmuka bagi admin cabang untuk menerbitkan Purchase Order Internal yang ditujukan ke Gudang Pusat dengan satuan pesanan berupa paket buku (bukan buku satuan), di mana penerbitan PO ini bersifat opsional untuk pemenuhan kebutuhan susulan atau siswa pindahan (ad-hoc replenishment), sedangkan distribusi awal tahun ajaran dapat diproses langsung oleh Gudang Pusat melalui alur push distribution tanpa mensyaratkan PO cabang terlebih dahulu.

#### Scenario: Cabang membuat PO paket ke pusat
- **WHEN** admin cabang memesan 50 unit "Paket Kelas 1 SD" dan 40 unit "Paket Kelas 2 SD" ke Gudang Pusat
- **THEN** sistem mencatat PO Internal baru dengan status `PENDING_HQ_APPROVAL` dan mengirim notifikasi ke Gudang Pusat

#### Scenario: Cabang tidak perlu membuat PO untuk alokasi awal tahun ajaran
- **WHEN** Gudang Pusat melakukan pengiriman alokasi buku massal berbasis data siswa aktif di cabang
- **THEN** sistem mengizinkan penerbitan Surat Jalan distribusi langsung dari Gudang Pusat ke cabang tanpa mengaitkan dokumen PO internal dari cabang
