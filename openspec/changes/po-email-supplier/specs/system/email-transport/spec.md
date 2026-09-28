## Purpose

Menyediakan layanan pengiriman email yang bekerja di semua runtime proyek (Cloudflare Workers untuk demo, Bun/VPS untuk produksi lokal) dengan status pengiriman yang jujur.

## ADDED Requirements

### Requirement: Pemilihan transport email otomatis

Sistem SHALL memilih transport pengiriman berdasarkan konfigurasi dan runtime: API email berbasis HTTP saat berjalan di Cloudflare Workers, SMTP standar saat berjalan di Bun/VPS, dan mode simulasi eksplisit saat tidak ada kredensial.

#### Scenario: Demo di Workers tanpa koneksi SMTP

- **WHEN** sistem berjalan di Cloudflare Workers dengan kredensial API email HTTP terkonfigurasi
- **THEN** email dikirim melalui HTTP API dan respons memuat identitas pengiriman asli dari provider

#### Scenario: Produksi lokal/VPS dengan SMTP

- **WHEN** sistem berjalan di Bun/VPS dengan konfigurasi SMTP lengkap
- **THEN** email dikirim melalui server SMTP yang dikonfigurasi

#### Scenario: Tanpa kredensial

- **WHEN** tidak ada kredensial email yang terkonfigurasi
- **THEN** sistem TIDAK mengklaim email terkirim; respons menandai pengiriman sebagai simulasi dan UI menampilkannya sebagai "Simulasi"

### Requirement: Konfigurasi provider email

Sistem SHALL menyimpan pilihan provider (`otomatis`, `API HTTP`, atau `SMTP`) beserta kredensialnya, dan SHALL NOT pernah mengekspos nilai rahasia (password, API key) ke frontend.

#### Scenario: Admin menyimpan konfigurasi

- **WHEN** admin menyimpan pengaturan email dengan provider dan kredensial baru
- **THEN** sistem menyimpan konfigurasi dan endpoint baca kembali menutupi nilai rahasia (misal `********`) sambil menandai apakah kredensial sudah terisi

### Requirement: Uji pengiriman yang jujur

Endpoint dan tombol uji email SHALL mengembalikan transport yang benar-benar dipakai beserta hasilnya, termasuk kegagalan yang jelas (misal pengirim belum terverifikasi di provider).

#### Scenario: Uji dengan kredensial valid

- **WHEN** admin mengirim email uji dengan konfigurasi lengkap dan pengirim terverifikasi
- **THEN** respons menyatakan email benar-benar terkirim beserta identitas pengiriman dari provider

#### Scenario: Uji tanpa kredensial

- **WHEN** admin mengirim email uji tanpa kredensial tersimpan
- **THEN** respons menyatakan pengiriman hanya disimulasikan dan menjelaskan kredensial apa yang belum diisi

#### Scenario: Uji dengan pengirim tak terverifikasi

- **WHEN** provider menolak karena alamat pengirim belum terverifikasi
- **THEN** respons menyatakan GAGAL dengan alasan eksplisit dari provider, bukan "berhasil dikirim"
