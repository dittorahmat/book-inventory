## Purpose

Menyediakan antarmuka dan API untuk mengelola akun pengguna, hak akses peran, serta penugasan pengguna ke cabang sekolah tertentu.

## ADDED Requirements

### Requirement: Pendaftaran dan Pembaruan Pengguna
Sistem HARUS memungkinkan Administrator Pusat untuk mendaftarkan akun baru, mengubah peran, serta menugaskan cabang sekolah kepada pengguna.

#### Scenario: Administrator Pusat membuat akun admin cabang baru
- **WHEN** Administrator Pusat mengisi formulir nama, email, peran `branch_admin`, dan memilih cabang sekolah yang diampu
- **THEN** Sistem menyimpan akun pengguna baru dan mengaitkannya dengan cabang sekolah yang dipilih

#### Scenario: Validasi penugasan sekolah untuk admin cabang
- **WHEN** Pengguna didaftarkan dengan peran `branch_admin` tanpa memilih cabang sekolah
- **THEN** Sistem menolak penyimpanan dan menampilkan peringatan validasi bahwa sekolah penugasan wajib diisi
