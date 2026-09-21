## ADDED Requirements

### Requirement: Pengelolaan Sekolah Melalui Antarmuka Pengguna
Sistem HARUS menyediakan antarmuka pengguna (UI) bagi Administrator Pusat untuk melihat daftar sekolah, mendaftarkan cabang baru, dan memperbarui informasi sekolah.

#### Scenario: Administrator Pusat mendaftarkan cabang sekolah baru melalui UI
- **WHEN** Administrator Pusat mengisi nama sekolah, kode sekolah, tipe cabang, dan alamat pada form manajemen sekolah
- **THEN** Cabang sekolah baru tersimpan dan langsung muncul di daftar opsi cabang sistem

#### Scenario: Validasi kepemilikan tunggal sekolah pusat (HQ)
- **WHEN** Pengguna mencoba mendaftarkan sekolah baru dengan tipe `main` padahal sekolah pusat sudah terdaftar
- **THEN** Sistem menolak dan menampilkan pesan bahwa sekolah pusat (HQ) sudah terdaftar
