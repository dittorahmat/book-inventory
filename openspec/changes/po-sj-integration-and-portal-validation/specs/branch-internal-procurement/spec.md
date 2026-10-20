# Spec Delta

## MODIFIED Requirements

### Requirement: Pengiriman Bertahap Multi Surat Jalan untuk Satu PO
Gudang Pusat SHALL dapat menerbitkan lebih dari satu Surat Jalan Pengiriman Internal terhadap satu PO Cabang yang sama untuk memenuhi pesanan paket secara bertahap saat sebagian stok buku belum tersedia.

#### Scenario: Gudang pusat mengirim sebagian paket dengan surat jalan pertama
- **WHEN** Gudang Pusat memproses pengiriman 50 paket yang baru memiliki 8 dari 10 buku komponen dengan menerbitkan Surat Jalan #SJ-INT-01
- **THEN** Cabang menerima pengiriman tahap 1, status PO Cabang tercatat `PARTIALLY_DELIVERED`, dan sistem mencatat 2 buku x 50 unit sebagai outstanding pengiriman pusat

#### Scenario: Gudang pusat mengirim susulan sisa buku dengan surat jalan kedua
- **WHEN** 2 buku yang tertunda telah tiba di pusat dan Gudang Pusat menerbitkan Surat Jalan #SJ-INT-02 pelunasan untuk PO yang sama
- **THEN** Cabang menerima pengiriman tahap 2 dan status pemenuhan PO otomatis berubah menjadi `COMPLETED` tanpa cabang perlu membuat PO kedua

## ADDED Requirements

### Requirement: Pemilihan PO Terutang dan Item Saran Editable pada Surat Jalan
Sistem SHALL menyediakan antarmuka bagi staf Gudang Pusat untuk memilih nomor PO Cabang yang berstatus terutang atau belum terpenuhi saat membuat Surat Jalan, mengisi daftar item saran secara otomatis berdasarkan sisa pesanan, serta mengizinkan staf mengedit kuantitas fisik riil yang dikirim.

#### Scenario: Memilih PO terutang dan menyesuaikan kuantitas kirim
- **WHEN** staf gudang pusat memilih PO #PO-CABANG-01 yang memesan 50 paket dan mengubah kuantitas kirim menjadi 30 paket pada formulir Surat Jalan
- **THEN** sistem menyimpan Surat Jalan dengan kuantitas 30 paket dan mencatat sisa 20 paket sebagai outstanding pada PO tersebut

### Requirement: Dukungan Mode Pengiriman Manual Tanpa PO
Sistem SHALL menyediakan opsi pengiriman manual bebas tanpa mengaitkan ke nomor PO manapun untuk mengakomodasi kebutuhan distribusi ad-hoc, penyangga buffer, atau penggantian buku rusak.

#### Scenario: Menerbitkan Surat Jalan manual
- **WHEN** staf gudang pusat mengaktifkan opsi "Pengiriman Manual Tanpa PO", memilih cabang tujuan, dan menginput daftar buku serta kuantitasnya secara manual
- **THEN** sistem menerbitkan Surat Jalan yang berelasi langsung ke cabang tujuan tanpa menuntut adanya referensi PO Internal

### Requirement: Konfirmasi Penerimaan Fisik oleh Cabang
Sistem SHALL menyediakan antarmuka bagi cabang untuk mengonfirmasi penerimaan fisik barang berdasarkan Surat Jalan yang diterima dan memperbarui status pemenuhan PO terkait.

#### Scenario: Cabang mengonfirmasi penerimaan barang sesuai Surat Jalan
- **WHEN** staf cabang menerima kiriman Surat Jalan #SJ-INT-01 dan menekan tombol konfirmasi penerimaan
- **THEN** status Surat Jalan berubah menjadi `DELIVERED`, stok inventaris cabang bertambah, dan status pemenuhan PO Cabang diperbarui
