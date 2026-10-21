# Spec Delta: term-stock-reconciliation

## Purpose
Menyediakan mekanisme audit stok akhir periode di cabang, mencatat selisih fisik vs sistem, menerbitkan Berita Acara Rekonsiliasi resmi beserta penagihan ganti rugi buku hilang ke Finance Cabang berbasis harga jual buku, serta memfasilitasi penarikan sisa fisik ke Gudang Pusat.

## ADDED Requirements

### Requirement: Sesi Audit Rekonsiliasi Stok Cabang
Sistem SHALL menyediakan antarmuka bagi tim logistik untuk membuka sesi audit stok akhir periode per cabang yang otomatis mengompilasi total buku terkirim, total buku diserahkan ke siswa, dan target sisa stok fisik yang seharusnya ada di rak cabang.

#### Scenario: Logistik membuka formulir audit akhir periode
- **WHEN** staf logistik memilih cabang dan periode ajaran untuk sesi rekonsiliasi
- **THEN** sistem menampilkan daftar paket buku dengan rincian total kirim (inbound), total serah terima siswa (handover), dan sisa sistem (expected remaining)

### Requirement: Pencatatan Hitungan Fisik dan Deteksi Selisih
Sistem SHALL menerima input hitungan fisik aktual dari logistik dan otomatis menghitung selisih (discrepancy) bila fisik kurang dari sisa sistem.

#### Scenario: Stok fisik dihitung sesuai dengan sisa sistem
- **WHEN** sisa sistem menunjukkan 3 unit dan logistik menginput hitungan fisik aktual 3 unit
- **THEN** sistem mencatat selisih 0 dan membuka opsi penerbitan Surat Jalan Tarik Sisa 3 unit ke Gudang Pusat

#### Scenario: Stok fisik lebih sedikit dari sisa sistem (buku hilang)
- **WHEN** sisa sistem menunjukkan 3 unit tetapi logistik hanya menemukan fisik 2 unit
- **THEN** sistem mencatat 2 unit sebagai stok yang ditarik dan 1 unit sebagai selisih hilang yang wajib ditagihkan ke cabang

### Requirement: Penerbitan Berita Acara Rekonsiliasi dan Nota Tagihan Cabang
Sistem SHALL menerbitkan dokumen Berita Acara Rekonsiliasi resmi serta Nota Tagihan Selisih (Loss Billing Memo) ke Finance Cabang senilai kuantitas buku hilang dikalikan harga jual resmi buku/paket, dilengkapi lampiran rekapitulasi penyerahan siswa yang dapat dicetak.

#### Scenario: Cetak Berita Acara dan Tagihan Selisih
- **WHEN** staf logistik memfinalisasi sesi rekonsiliasi yang memiliki 1 unit buku hilang seharga Rp 150.000
- **THEN** sistem menghasilkan dokumen Berita Acara resmi dan faktur tagihan senilai Rp 150.000 yang ditujukan ke Finance Cabang lengkap dengan lampiran daftar siswa yang telah menerima buku

### Requirement: Penarikan Sisa Stok Fisik ke Gudang Pusat dan Opsi Pembongkaran
Sistem SHALL menerbitkan Surat Jalan Pengembalian Cabang ke Gudang Pusat untuk seluruh sisa fisik yang ditemukan, dan menyediakan aksi unbundling (pembongkaran paket) menjadi stok satuan di Gudang Pusat.

#### Scenario: Gudang Pusat menerima sisa paket dan membongkar ke stok satuan
- **WHEN** paket sisa tiba di Gudang Pusat dan staf gudang memilih aksi "Bongkar Paket (Unbundle)"
- **THEN** sistem menghapus saldo paket terkait dan menambahkan stok masing-masing buku komponen penyusunnya ke loose stock Gudang Pusat
