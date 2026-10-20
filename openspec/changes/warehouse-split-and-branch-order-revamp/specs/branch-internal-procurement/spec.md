# Spec Delta

## MODIFIED Requirements

### Requirement: Penerbitan PO Internal Cabang Berbasis Paket
Sistem SHALL menyediakan antarmuka bagi admin cabang untuk menerbitkan Purchase Order Internal yang ditujukan ke Gudang Pusat dengan satuan pesanan berupa paket buku (bukan buku satuan), dengan batasan maksimal kuota pesanan tidak boleh melebihi jumlah siswa aktif di cabang pada jenjang tersebut.

#### Scenario: Cabang membuat PO paket ke pusat dalam batas kuota
- **WHEN** cabang memiliki 50 siswa aktif jenjang Kelas 1 SD dan admin cabang memesan 50 unit "Paket Kelas 1 SD" ke Gudang Pusat
- **THEN** sistem menerima pesanan, mencatat PO Internal baru dengan status `PENDING_HQ_APPROVAL`, dan mengirim notifikasi ke Gudang Pusat

#### Scenario: Cabang memesan melebihi kuota siswa aktif
- **WHEN** cabang memiliki 50 siswa aktif jenjang Kelas 1 SD dan admin cabang mencoba memesan 55 unit "Paket Kelas 1 SD"
- **THEN** sistem menolak pembuatan pesanan dan menampilkan peringatan bahwa jumlah pesanan melebihi jumlah siswa terdaftar pada jenjang tersebut

## ADDED Requirements

### Requirement: Label Antarmuka Dinamis Berdasarkan Peran
Sistem SHALL menampilkan label navigasi dan judul antarmuka secara kontekstual: "Pesan ke Gudang" untuk pengguna peran cabang dan "Pesanan dari Cabang" untuk pengguna peran gudang pusat.

#### Scenario: Tampilan label di sisi cabang
- **WHEN** admin cabang membuka navigasi pesanan internal
- **THEN** label modul dan judul halaman ditampilkan sebagai "Pesan ke Gudang"

#### Scenario: Tampilan label di sisi gudang pusat
- **WHEN** admin gudang pusat membuka navigasi pesanan internal
- **THEN** label modul dan judul halaman ditampilkan sebagai "Pesanan dari Cabang"

### Requirement: Proses Pemenuhan Surat Jalan Langsung dan Unggah Bukti Terima Fisik
Sistem SHALL menyediakan tombol "Proses" di sisi gudang pusat yang langsung menampilkan Surat Jalan (SJ) siap cetak, serta menyediakan slot pengunggahan dokumen bukti terima fisik (SJ yang telah ditandatangani dan dicap basah oleh cabang).

#### Scenario: Gudang memproses pesanan dan mencetak Surat Jalan
- **WHEN** petugas gudang pusat menekan tombol "Proses" pada pesanan cabang yang disetujui
- **THEN** sistem memperbarui status pengiriman menjadi `PROCESSING` / `IN_TRANSIT` dan langsung menampilkan lembar Surat Jalan resmi untuk dicetak fisik bersama kurir

#### Scenario: Cabang mengunggah bukti serah terima bertanda tangan dan cap
- **WHEN** barang fisik telah sampai dan cabang mengunggah pindaian atau foto Surat Jalan yang telah ditandatangani dan dicap basah
- **THEN** sistem mencatat file tersebut sebagai Bukti Terima resmi dan menandai pemenuhan pesanan telah diterima lengkap oleh cabang

## REMOVED Requirements

### Requirement: Modul Transfer Antar-Gudang Mandiri
**Reason**: Modul transfer stok antar-cabang/gudang lama dihapus karena redundan dengan siklus resmi Pesanan Cabang dan Surat Jalan Gudang Pusat (prinsip YAGNI).
**Migration**: Seluruh pergerakan buku dan paket antara pusat dan cabang dilakukan melalui modul Pesanan Cabang / Pesan ke Gudang.
