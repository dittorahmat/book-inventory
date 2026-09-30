## Purpose

Membuka pemesanan satuan di portal publik berdampingan dengan paket, dengan keterbukaan yang dikontrol cut-off per tahun ajaran agar tertib mengikuti kalender akademik.

## ADDED Requirements

### Requirement: Portal mendukung order satuan dan paket
Sistem SHALL mengizinkan orang tua memilih item satuan (per judul dengan kuantitas) selain paket pada form publik, dan SHALL mencatat order satuan dengan total dari harga jual satuan.

#### Scenario: Memesan satuan saat dibuka
- **WHEN** orang tua memilih dua judul satuan masing-masing satu eksemplar pada periode satuan dibuka
- **THEN** sistem membuat order satuan dengan total sama dengan jumlah harga jual kedua buku

#### Scenario: Satuan tertutup hanya paket
- **WHEN** orang tua membuka form publik pada periode satuan tertutup
- **THEN** sistem hanya menawarkan pilihan paket dan menyembunyikan pilihan satuan

### Requirement: Cut-off satuan per tahun ajaran berbasis tanggal WIB
Sistem SHALL menyimpan satu tanggal efektif pembuka order satuan per tahun ajaran; order satuan terbuka jika dan hanya jika tanggal hari ini (zona Asia/Jakarta) sama dengan atau melewati tanggal tersebut, atau override manual sedang aktif. Tanpa pengaturan pada tahun ajaran berjalan, order satuan tertutup.

#### Scenario: Tahun ajaran baru otomatis tertutup
- **WHEN** tahun ajaran baru dimulai (misalnya Agustus) dan admin belum mengatur tanggal satuan tahun tersebut
- **THEN** form publik hanya menawarkan paket sampai admin mengatur tanggalnya

#### Scenario: Batas tanggal memakai WIB
- **WHEN** waktu server UTC masih tanggal 31 Juli pukul 18.00 (sudah 1 Agustus pukul 01.00 WIB) dan tanggal efektif adalah 1 Agustus
- **THEN** sistem menilai order satuan sudah terbuka karena mengikuti WIB

### Requirement: Override manual per tahun ajaran
Sistem SHALL menyediakan saklar manual per tahun ajaran yang bila aktif mengalahkan aturan tanggal (paksa buka atau paksa tutup) untuk keadaan darurat.

#### Scenario: Tutup paksa saat stok bermasalah
- **WHEN** admin mengaktifkan override tutup paksa padahal tanggal efektif sudah lewat
- **THEN** form publik menyembunyikan pilihan satuan sampai override dimatikan

### Requirement: Pengaturan cut-off oleh admin
Sistem SHALL menyediakan pengaturan tanggal efektif dan override per tahun ajaran yang hanya dapat diubah peran berwenang (central admin / admin gudang).

#### Scenario: Admin mengatur tanggal tahun berjalan
- **WHEN** admin menyimpan tanggal efektif untuk tahun ajaran berjalan
- **THEN** sistem menerapkan aturan buka-tutup satuan mulai tanggal tersebut dalam WIB
