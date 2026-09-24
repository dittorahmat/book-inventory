## Purpose

Menyediakan data demo komprehensif dan realistis yang mencakup data profil siswa lama dan baru, master buku satuan lokal & internasional, master paket buku, transaksi bundling, pesanan dengan aneka status pembayaran & pemenuhan, pengadaan supplier, dan simulasi retur buku rusak.

## ADDED Requirements

### Requirement: Penyemaian Data Demo Komprehensif (Complete Seed)
Sistem SHALL menyediakan endpoint reset dan penyemaian data (`/api/demo/seed`) yang memuat seluruh entitas baru dan mensimulasikan skenario operasional nyata di sekolah.

#### Scenario: Menjalankan demo seed menghasilkan data yang siap diuji
- **WHEN** Pengguna menjalankan proses reset & seed data demo
- **THEN** Sistem mengisi database dengan:
  - Siswa lama seperti "Hendra Wahyudi" yang siap naik kelas
  - Siswa baru terdaftar
  - Master buku satuan (Cambridge, Agama Islam, Bahasa Indonesia, dll)
  - Master paket buku (Paket SD 1 Internasional 12 buku, Paket SD 1 Nasional)
  - Stok satuan loose dan stok paket ready
  - Pesanan dengan status: Lunas & Sudah Ambil, Cicilan/Parsial & Belum Ambil, Beasiswa Menunggu Approval, Belum Bayar
  - Dokumen PO supplier dan histori retur buku cacat
