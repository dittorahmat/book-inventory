# whatsapp-notification-bridge Specification

## Purpose
Menyediakan antarmuka pengiriman pesan WhatsApp melalui WhatsApp Cloud API resmi (Meta) yang kompatibel dengan runtime Cloudflare Workers.

## Requirements

### Requirement: Kanal Tunggal WhatsApp Cloud API Resmi (Meta)
Sistem backend Cloudflare Workers SHALL mengirimkan pesan WhatsApp hanya melalui WhatsApp Cloud API resmi (Meta) dengan memanggil endpoint REST Graph API tanpa mempertahankan socket TCP di dalam worker. Kanal gateway HTTP generik tidak lagi didukung.

#### Scenario: Backend mengirim pesan notifikasi via Cloud API Meta
- **WHEN** sebuah event pemicu notifikasi terjadi di sistem dengan nomor tujuan yang valid dan kredensial Cloud API terkonfigurasi
- **THEN** backend melakukan HTTP POST ke endpoint Graph API Meta berisi nomor tujuan dan teks pesan

#### Scenario: Kredensial Cloud API belum dikonfigurasi
- **WHEN** nomor telepon pengirim atau access token WhatsApp Cloud API belum diisi atau kanal dinonaktifkan
- **THEN** pengiriman disimulasikan tanpa melempar error, hasil ditandai `simulated`, dan transaksi pemanggil tetap berhasil

### Requirement: Notifikasi Otomatis Konfirmasi Pemesanan Siswa
Sistem SHALL secara otomatis memicu pengiriman pesan WhatsApp kepada orang tua saat formulir pemesanan siswa berhasil dibuat atau status pembayaran diperbarui.

#### Scenario: Orang tua menerima notifikasi rincian pesanan
- **WHEN** orang tua menyelesaikan form pemesanan buku dengan nomor WhatsApp yang aktif
- **THEN** sistem mengirimkan pesan WhatsApp berisi nomor order, ringkasan judul/paket buku, total tagihan/uang muka, dan petunjuk pengambilan

### Requirement: Notifikasi Hasil Verifikasi Bukti Pembayaran
Sistem SHALL mengirimkan notifikasi kepada orang tua saat klaim bukti transfer diverifikasi (pesanan lunas) maupun saat ditolak (beserta alasan dan tautan unggah ulang yang sama), melalui email dan WhatsApp resmi, tanpa menggagalkan transaksi apabila salah satu kanal gagal terkirim.

#### Scenario: Orang tua diberi tahu pembayaran diverifikasi
- **WHEN** gudang memverifikasi klaim bukti transfer yang membuat pesanan menjadi lunas
- **THEN** sistem mengirimkan email dan WhatsApp berisi bahwa pembayaran telah diterima dan pesanan lunas

#### Scenario: Orang tua diberi tahu bukti ditolak
- **WHEN** gudang menolak klaim bukti transfer dengan alasan
- **THEN** sistem mengirimkan email dan WhatsApp berisi alasan penolakan serta tautan yang sama untuk mengunggah ulang tanpa membuat pesanan baru

#### Scenario: Kanal gagal tidak menggagalkan verifikasi
- **WHEN** kredensial WhatsApp atau email belum dikonfigurasi atau salah
- **THEN** perubahan status pembayaran tetap tersimpan dan API tetap mengembalikan status pengiriman tiap kanal agar staf dapat menindaklanjuti

### Requirement: Notifikasi Otomatis Penerbitan PO
Sistem SHALL mendukung pengiriman pesan ringkasan PO ke perwakilan supplier atau admin cabang melalui WhatsApp saat PO baru diterbitkan.

#### Scenario: Notifikasi PO baru terkirim
- **WHEN** admin gudang menyetujui dan menerbitkan Purchase Order baru ke supplier
- **THEN** sistem mengirimkan pesan WhatsApp notifikasi ke nomor kontak supplier terkait dengan rincian nomor PO dan total kuantiti
