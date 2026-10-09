# whatsapp-notification-bridge Specification

## Purpose
Menyediakan antarmuka komunikasi pengiriman pesan WhatsApp berbasis nomor telepon internal/sendiri melalui abstraksi REST gateway HTTP yang kompatibel dengan runtime Cloudflare Workers.

## Requirements

### Requirement: Abstraksi Pengiriman Pesan WhatsApp via HTTP Gateway
Sistem backend Cloudflare Workers SHALL mengirimkan pesan WhatsApp dengan memanggil endpoint REST HTTP ke sidecar atau gateway WhatsApp independen tanpa mempertahankan socket TCP di dalam worker.

#### Scenario: Backend mengirim pesan notifikasi via REST client
- **WHEN** sebuah event pemicu notifikasi terjadi di sistem dengan nomor tujuan yang valid
- **THEN** backend melakukan HTTP POST payload JSON berisi nomor tujuan dan teks pesan ke configured gateway URL

### Requirement: Notifikasi Otomatis Konfirmasi Pemesanan Siswa
Sistem SHALL secara otomatis memicu pengiriman pesan WhatsApp kepada orang tua saat formulir pemesanan siswa berhasil dibuat atau status pembayaran diperbarui.

#### Scenario: Orang tua menerima notifikasi rincian pesanan
- **WHEN** orang tua menyelesaikan form pemesanan buku dengan nomor WhatsApp yang aktif
- **THEN** sistem mengirimkan pesan WhatsApp berisi nomor order, ringkasan judul/paket buku, total tagihan/uang muka, dan petunjuk pengambilan

### Requirement: Notifikasi Otomatis Penerbitan PO
Sistem SHALL mendukung pengiriman pesan ringkasan PO ke perwakilan supplier atau admin cabang melalui WhatsApp saat PO baru diterbitkan.

#### Scenario: Notifikasi PO baru terkirim
- **WHEN** admin gudang menyetujui dan menerbitkan Purchase Order baru ke supplier
- **THEN** sistem mengirimkan pesan WhatsApp notifikasi ke nomor kontak supplier terkait dengan rincian nomor PO dan total kuantiti
