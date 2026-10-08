## Purpose

Mengelola siklus hidup paket buku secara menyeluruh, termasuk pembongkaran otomatis stok fisik bundel saat paket dihapus dan pembersihan data demo.

## ADDED Requirements

### Requirement: Penghapusan Paket Buku dengan Auto-Unbundle
Sistem SHALL menyediakan kemampuan menghapus definisi paket buku. Sebelum data paket dihapus, seluruh stok fisik bundel paket yang masih berstatus `in_stock` pada sekolah/cabang terkait SHALL secara otomatis dibongkar (unbundled) dan dikembalikan menjadi buku satuan berkondisi baru (`condition: 'new'`, `status: 'in_stock'`).

#### Scenario: Menghapus paket yang memiliki bundel aktif
- **WHEN** pengguna melakukan request penghapusan paket buku yang memiliki 5 bundel fisik `in_stock`
- **THEN** sistem membongkar 5 bundel tersebut menjadi buku satuan komponen di cabang terkait, menghapus relasi item BOM dan bundel, lalu menghapus data master paket buku dengan respons sukses 200

#### Scenario: Menghapus paket yang tidak memiliki bundel aktif
- **WHEN** pengguna menghapus paket yang belum pernah dirakit (0 bundel)
- **THEN** sistem langsung menghapus komponen BOM dan data master paket tanpa mutasi stok satuan

### Requirement: Tombol Aksi Hapus Granular di UI
Sistem antarmuka web SHALL menampilkan tombol hapus pada baris data paket buku di halaman Manajemen Paket dengan dialog konfirmasi sebelum eksekusi.

#### Scenario: Pengguna menekan tombol hapus paket
- **WHEN** pengguna mengklik tombol hapus pada salah satu paket dan menyetujui dialog konfirmasi
- **THEN** sistem memanggil API hapus paket, menampilkan notifikasi sukses, dan memperbarui daftar paket secara otomatis
