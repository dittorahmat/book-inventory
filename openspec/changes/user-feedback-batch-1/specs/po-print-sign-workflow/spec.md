## Purpose

Menegakkan alur bisnis PO sesuai proses nyata — dokumen dicetak, ditandatangani basah dan dicap, buktinya diupload — sebelum PO boleh dikirim ke supplier.

## ADDED Requirements

### Requirement: Status cetak sebelum tanda tangan
Sistem SHALL menyediakan transisi status PO dari `draft` ke `printed` yang menandai dokumen PO sudah dicetak dan siap ditandatangani.

#### Scenario: Menandai PO sebagai sudah dicetak
- **WHEN** pengguna menekan aksi "Tandai Sudah Dicetak" pada PO berstatus `draft`
- **THEN** status PO berubah menjadi `printed` dan tercatat waktu pencetakannya

### Requirement: Upload bukti TTD basah dan cap sebagai syarat kirim
Sistem SHALL mewajibkan satu berkas bukti ( hasil scan/foto dokumen bertanda tangan basah dan cap ) terupload pada PO sebelum aksi kirim ke supplier dapat dijalankan, dan SHALL menyimpan referensi berkas tersebut pada PO.

#### Scenario: Kirim ditolak tanpa bukti
- **WHEN** pengguna menekan aksi kirim pada PO berstatus `printed` yang belum memiliki berkas bukti
- **THEN** sistem menolak dengan pesan bahwa bukti TTD dan cap wajib diupload terlebih dahulu dan status tetap `printed`

#### Scenario: Kirim berhasil setelah upload
- **WHEN** pengguna mengupload berkas bukti pada PO berstatus `printed` lalu menekan kirim
- **THEN** status PO berubah menjadi `signed_uploaded` setelah upload dan menjadi `sent` setelah pengiriman berhasil, beserta catatan waktu kirim dan tujuan kirim

### Requirement: Berkas bukti dapat diakses kembali
Sistem SHALL menampilkan pratinjau atau tautan unduh berkas bukti TTD pada detail PO yang sudah melewati tahap upload.

#### Scenario: Melihat bukti pada PO terkirim
- **WHEN** pengguna membuka detail PO berstatus `sent` yang dibuat setelah change ini
- **THEN** sistem menampilkan berkas bukti yang pernah diupload

### Requirement: PO lama tidak terdampak
Sistem SHALL membiarkan PO yang sudah berstatus `sent` (atau lebih jauh) sebelum change ini tetap valid tanpa bukti upload dan tanpa perubahan status.

#### Scenario: PO lama tetap terkirim
- **WHEN** pengguna membuka detail PO lama berstatus `sent` tanpa berkas bukti
- **THEN** sistem menampilkannya normal tanpa peringatan wajib upload
