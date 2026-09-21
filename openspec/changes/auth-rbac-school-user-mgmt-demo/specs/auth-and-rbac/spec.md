## Purpose

Mengatur sistem autentikasi pengguna, pengelolaan sesi login, serta penegakan hak akses berbasis peran (RBAC) antara Administrator Pusat dan Administrator Cabang.

## ADDED Requirements

### Requirement: Autentikasi Pengguna dan Sesi
Sistem HARUS menyediakan mekanisme login berbasis kredensial yang memvalidasi identitas pengguna dan menerbitkan session cookie/token yang aman.

#### Scenario: Login berhasil dengan kredensial valid
- **WHEN** Pengguna memasukkan email dan password yang benar pada halaman login
- **THEN** Sistem memvalidasi kredensial, membuat sesi baru, dan mengembalikan data profil pengguna serta peran aktifnya

#### Scenario: Login gagal dengan kredensial salah
- **WHEN** Pengguna memasukkan kombinasi email atau password yang tidak sesuai
- **THEN** Sistem menolak permintaan autentikasi dan memberikan pesan kesalahan yang informatif tanpa membocorkan eksistensi akun

### Requirement: Penegakan Hak Akses Berbasis Peran (RBAC)
Sistem HARUS membedakan wewenang antara peran `central_admin` (Administrator Pusat) dan `branch_admin` (Administrator Cabang).

#### Scenario: Administrator Pusat mengakses seluruh data cabang
- **WHEN** Pengguna dengan peran `central_admin` mengakses katalog, inventaris, atau memindahbukukan transfer
- **THEN** Sistem memberikan akses penuh untuk melihat dan mengelola data di seluruh cabang sekolah

#### Scenario: Administrator Cabang dibatasi pada cabang miliknya
- **WHEN** Pengguna dengan peran `branch_admin` mengakses inventaris atau membuat permintaan transfer
- **THEN** Sistem membatasi operasi hanya pada sekolah cabang tempat pengguna tersebut ditugaskan
