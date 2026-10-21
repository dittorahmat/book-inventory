# Spec Delta

## Purpose

Mengatur isolasi navigasi modul dan penentuan tab awal otomatis berbasis role staf untuk mencegah akses tidak sah atau tampilan salah sasaran.

## ADDED Requirements

### Requirement: Role Default Tab Routing
Sistem antarmuka staf SHALL secara otomatis mengarahkan navigasi tab aktif pengguna ke tab pertama yang diizinkan untuk perannya ketika login atau ketika tab aktif saat ini tidak berada dalam daftar tab yang diizinkan untuk perannya.

#### Scenario: Admin Gudang Seragam mendarat di modul seragam
- **WHEN** pengguna dengan role `warehouse_uniforms_admin` berhasil login ke aplikasi
- **THEN** tab aktif pertama kali secara otomatis diarahkan ke tab `uniforms` ("Gudang Seragam") dan tidak membuka modul pesanan cabang atau dashboard.

#### Scenario: Branch Admin mendarat di modul pesanan ke gudang
- **WHEN** pengguna dengan role `branch_admin` atau `school_admin` berhasil login
- **THEN** tab aktif pertama kali secara otomatis diarahkan ke tab `internal_orders` ("Pesan ke Gudang").

#### Scenario: Admin Gudang Buku mendarat di modul pesanan cabang
- **WHEN** pengguna dengan role `warehouse_books_admin` berhasil login
- **THEN** tab aktif pertama kali secara otomatis diarahkan ke tab `internal_orders` ("Pesanan dari Cabang").

#### Scenario: Pengguna mencoba mengakses tab di luar wewenangnya
- **WHEN** pengguna staf membuka URL atau state tab yang tidak tercantum dalam daftar wewenang navigasinya
- **THEN** antarmuka secara otomatis mengembalikan tab aktif ke default tab sah untuk rolenya.

### Requirement: Role Desktop and Mobile Navigation Visibility
Daftar tombol menu navigasi desktop dan navigasi mobile bar SHALL disinkronkan dan hanya menampilkan modul yang diizinkan sesuai role staf aktif.

#### Scenario: Admin Gudang Seragam melihat navigasi terisolasi
- **WHEN** pengguna dengan role `warehouse_uniforms_admin` melihat bilah navigasi desktop maupun mobile
- **THEN** hanya tab `uniforms` ("Gudang Seragam") yang ditampilkan, dan tab buku, katalog, stok satuan, paket, serta pesanan cabang disembunyikan.

#### Scenario: Admin Gudang Umum dapat melihat modul buku dan seragam
- **WHEN** pengguna dengan role `warehouse_admin` membuka bilah navigasi
- **THEN** sistem menampilkan tab dashboard, logistik buku, dan gudang seragam sesuai cakupan tugasnya sebagai admin gudang umum.

### Requirement: Accurate Staff Header Role Label
Header bilah atas antarmuka staf SHALL menampilkan deskripsi role pengguna yang akurat sesuai identitas akunnya dan tidak melabeli staf gudang logistik sebagai branch admin.

#### Scenario: Label role admin gudang di header
- **WHEN** pengguna dengan role `warehouse_uniforms_admin`, `warehouse_books_admin`, atau `warehouse_admin` login
- **THEN** teks badge role di bawah nama pengguna di header menampilkan sebutan gudang yang sesuai (misal "Admin Gudang Seragam", "Admin Gudang Buku", "Admin Gudang").
