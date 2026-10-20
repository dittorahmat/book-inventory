# Spec Delta

## Purpose
Mengatur aturan validasi checkout pada portal pemesanan siswa untuk memastikan ketersediaan bukti transfer pembayaran dan membatasi opsi metode serah terima paket buku hanya di lingkungan sekolah.

## ADDED Requirements

### Requirement: Wajib Unggah Bukti Transfer Sebelum Submit Pesanan
Sistem SHALL mewajibkan orang tua atau pemesan untuk mengunggah berkas bukti transfer pembayaran sebelum tombol atau aksi submit pesanan dapat dijalankan, dan menolak pemrosesan pesanan yang tidak menyertakan berkas bukti transfer.

#### Scenario: Pemesan mencoba submit tanpa mengunggah bukti transfer
- **WHEN** pengguna berada di halaman checkout portal dan belum mengunggah file bukti transfer
- **THEN** tombol submit pesanan berstatus disabled atau saat ditekan sistem menampilkan pesan validasi bahwa bukti transfer wajib diunggah

#### Scenario: Pemesan berhasil submit dengan menyertakan bukti transfer
- **WHEN** pengguna telah memilih file bukti transfer yang valid dan menekan tombol submit pesanan
- **THEN** sistem mengunggah bukti transfer, menyimpan pesanan ke basis data, dan mengarahkan pengguna ke halaman konfirmasi sukses

### Requirement: Pembatasan Metode Serah Terima Paket Buku di Sekolah
Sistem SHALL hanya menyediakan metode serah terima langsung di sekolah/kelas untuk pemesanan paket buku dan menonaktifkan atau menyembunyikan pilihan pengiriman ekspedisi ke rumah.

#### Scenario: Pemesan memilih paket buku pada formulir pemesanan
- **WHEN** pengguna memilih pesanan tipe paket buku
- **THEN** opsi metode serah terima yang tersedia hanya pengambilan/pembagian langsung di sekolah dan opsi pengiriman ke rumah tidak ditampilkan

#### Scenario: Pemesan memesan buku satuan di luar paket
- **WHEN** pengguna melakukan pemesanan buku satuan susulan
- **THEN** sistem menyediakan pilihan metode serah terima baik pengambilan di sekolah maupun pengiriman ekspedisi ke rumah
