## Purpose

Menyediakan pengaturan parameter server SMTP dan pengiriman email otomatis transaksional untuk pemberitahuan pemesanan, verifikasi pembayaran, pengingat cicilan, dan instruksi penyerahan paket buku.

## ADDED Requirements

### Requirement: Konfigurasi Parameter SMTP
Sistem SHALL menyediakan antarmuka bagi Central Admin untuk mengonfigurasi host SMTP, port, enkripsi TLS/SSL, username, password, dan sender name, serta fitur uji kirim email (test connection).

#### Scenario: Uji coba koneksi SMTP berhasil
- **WHEN** Admin memasukkan kredensial SMTP dan mengklik "Kirim Email Uji Coba" ke alamat email admin
- **THEN** Sistem mengirimkan pesan tes dan menampilkan indikator sukses koneksi SMTP

### Requirement: Notifikasi Email Otomatis Transaksional
Sistem SHALL secara otomatis mengirimkan email kepada orang tua siswa saat terjadi peristiwa penting pada pesanan buku.

#### Scenario: Email konfirmasi pemesanan terkirim
- **WHEN** Orang tua berhasil mengirim formulir pemesanan buku melalui portal publik
- **THEN** Sistem mengirimkan email berisi nomor registrasi pesanan, rincian daftar buku/paket, petunjuk pembayaran, dan link pengecekan status pesanan

#### Scenario: Email pemberitahuan paket siap diambil
- **WHEN** Admin gudang mengubah status fisik buku menjadi "ready_for_pickup"
- **THEN** Sistem otomatis mengirimkan email ke alamat orang tua yang memberitahukan bahwa paket buku sudah selesai dirakit dan siap diambil di sekolah
