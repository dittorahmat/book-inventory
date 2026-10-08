## Purpose

Menyediakan proses transfer antarcabang yang efisien dengan dukungan transfer instan, pemisahan tab status pengiriman, dan tombol aksi operasional langsung di antarmuka.

## ADDED Requirements

### Requirement: Opsi Transfer Langsung (Instant Transfer)
Sistem SHALL mendukung pembuatan transfer antarsekolah dengan opsi `instant: true`. Ketika opsi ini dipilih, eksemplar buku satuan maupun bundel paket SHALL langsung dialokasikan dan dipindahkan kepemilikannya ke lokasi tujuan (`currentSchoolId = toSchoolId`) dan status transfer langsung tercatat sebagai `completed` tanpa fase transit.

#### Scenario: Pembuatan transfer instan
- **WHEN** pengguna membuat transfer dari Pusat ke cabang dengan mencentang opsi transfer instan
- **THEN** sistem langsung mengurangi stok fisik di Pusat, menambah stok fisik di cabang tujuan, dan mencatat status transfer sebagai `completed`

### Requirement: Tombol Aksi Cepat pada Kartu Transfer
Antarmuka daftar transfer SHALL menampilkan tombol aksi utama langsung pada kartu/baris transfer tanpa mewajibkan pengguna membuka popup modal detail:
1. Tombol `Dispatch Pengiriman` untuk transfer berstatus `draft`.
2. Tombol `Konfirmasi Penerimaan` untuk transfer berstatus `in_transit`.

#### Scenario: Mengonfirmasi penerimaan langsung dari kartu transfer
- **WHEN** pengguna mengklik tombol 'Konfirmasi Penerimaan' pada kartu transfer yang berstatus `in_transit`
- **THEN** sistem memproses penerimaan transfer, memperbarui status menjadi `completed`, memindahkan stok ke sekolah tujuan, dan me-refresh tampilan

### Requirement: Filter Status Transfer
Halaman Transfer Antarcabang SHALL menyediakan kontrol filter berbasis status (`Semua`, `Draft`, `In Transit`, `Completed`) untuk menyaring daftar kartu transfer dan mencegah penumpukan data di layar.

#### Scenario: Pengguna memilih filter In Transit
- **WHEN** pengguna memilih tab/filter 'In Transit'
- **THEN** daftar transfer hanya menampilkan pengiriman yang sedang dalam perjalanan
