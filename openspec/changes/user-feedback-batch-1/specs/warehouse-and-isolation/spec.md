## Purpose

Menetapkan gudang logistik tunggal sebagai pusat pengadaan, peran admin gudang dan admin sekolah yang terisolasi, serta distribusi ke sekolah yang hanya lewat transfer.

## ADDED Requirements

### Requirement: Satu lokasi gudang logistik
Sistem SHALL memiliki tepat satu lokasi bertipe gudang ("Gudang Logistik") sebagai tujuan seluruh PO dan titik awal distribusi.

#### Scenario: Membuat PO tanpa memilih tujuan
- **WHEN** pengguna membuat PO baru
- **THEN** form tidak menampilkan pilihan sekolah tujuan dan PO otomatis bertujuan ke gudang logistik

### Requirement: PO selalu bertujuan ke gudang
Sistem SHALL menolak PO yang bertujuan ke lokasi selain gudang logistik.

#### Scenario: Upaya membuat PO ke sekolah
- **WHEN** permintaan pembuatan PO dikirim dengan tujuan ID sekolah cabang
- **THEN** sistem menolak dengan pesan bahwa PO hanya dapat bertujuan ke gudang logistik

### Requirement: Distribusi ke sekolah hanya lewat transfer
Sistem SHALL menyalurkan buku dari gudang ke sekolah hanya melalui transfer antar lokasi; tidak ada jalur penerimaan langsung dari supplier ke sekolah.

#### Scenario: Sekolah menerima buku
- **WHEN** sekolah membutuhkan buku dari pengadaan baru
- **THEN** satu-satunya cara adalah transfer dari gudang logistik ke sekolah tersebut

### Requirement: Peran admin gudang dan admin sekolah
Sistem SHALL menyediakan peran admin gudang (mengelola gudang, PO, dan transfer keluar) dan admin sekolah (mengelola hanya lokasi sekolahnya), di samping central admin yang melihat semuanya.

#### Scenario: Admin sekolah melihat datanya sendiri
- **WHEN** admin Al Wildan 1 membuka stok, order, transfer, dan laporan
- **THEN** sistem hanya menampilkan data lokasi Al Wildan 1

#### Scenario: Admin sekolah tidak dapat mengintip sekolah lain
- **WHEN** admin Al Wildan 1 mencoba mengakses data stok Al Wildan 2 lewat API maupun UI
- **THEN** sistem menolak atau mengembalikan data kosong dengan pesan akses ditolak

### Requirement: Penegakan isolasi di semua endpoint
Sistem SHALL memfilter setiap endpoint data (stok, PO, transfer, order, pembayaran, laporan, dashboard) berdasarkan peran dan lokasi pengguna; central admin tidak difilter, peran lain difilter ke lokasinya.

#### Scenario: Audit endpoint tanpa filter
- **WHEN** endpoint data dipanggil oleh admin sekolah tanpa parameter lokasi
- **THEN** sistem tetap membatasi hasil pada lokasi pengguna tersebut
