# Spec Delta

## Purpose

Mengelola alur pengembalian dana dan buku (refund) dari orang tua yang diproses di Gudang Pusat serta memfasilitasi retur buku rusak/kelebihan kepada supplier (Return to Vendor).

## MODIFIED Requirements

### Requirement: Penggantian Menu Retur Publik Menjadi Form Pengajuan Refund
Sistem SHALL menyediakan kembali formulir publik pengajuan refund buku dengan antarmuka pencarian data siswa berbasis NIS atau nama siswa setelah memilih cabang, serta secara otomatis memuat daftar buku yang pernah diserahkan kepada siswa tersebut.

#### Scenario: Orang tua mencari data siswa pada form publik refund
- **WHEN** orang tua memilih cabang dan memasukkan minimal 2 karakter NIS atau nama siswa
- **THEN** sistem menampilkan saran siswa yang sesuai beserta riwayat buku/paket yang berhak diajukan refund

#### Scenario: Orang tua mengajukan permohonan refund buku
- **WHEN** orang tua memilih satu atau beberapa judul buku, melihat harga acuan refund, mengunggah foto fisik buku, dan mengirim form
- **THEN** sistem mencatat pengajuan refund pada entitas `book_returns` dengan status `PENDING` dan menghasilkan kode referensi pengajuan

### Requirement: Eksekusi Refund Orang Tua di Gudang Pusat Menambah Stok
Sistem SHALL menyediakan antarmuka bagi admin logistik di Gudang Pusat pada tab "Refund Buku" (sebelumnya Retur Buku) untuk melakukan checklist approval per item buku yang direfund berdasarkan verifikasi foto fisik, serta menyediakan tombol ekspor laporan refund.

#### Scenario: Admin menyetujui refund buku layak pakai
- **WHEN** admin Gudang Pusat memeriksa foto fisik buku, mencentang checklist approval pada item buku yang diajukan, dan menekan tombol setujui
- **THEN** status item `book_returns` diperbarui menjadi `REFUNDED` / `APPROVED`, stok buku bertambah 1 di inventori gudang pusat, dan data siap diekspor ke Finance

#### Scenario: Admin logistik mengunduh laporan rekap refund
- **WHEN** admin logistik memfilter data refund yang telah diapprove dan menekan tombol unduh CSV/Excel
- **THEN** sistem mengunduh file rekapitulasi data refund buku untuk diserahkan secara manual ke tim Finance
