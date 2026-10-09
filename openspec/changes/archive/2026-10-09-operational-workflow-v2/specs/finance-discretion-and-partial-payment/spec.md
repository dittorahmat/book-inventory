## Purpose

Mengakomodasi pembayaran parsial (uang muka/angsuran) pada pemesanan siswa serta memberikan wewenang kontrol diskresi kepada tim Finance untuk penyesuaian nominal, pembebasan biaya, atau izin serah terima buku.

## ADDED Requirements

### Requirement: Dukungan Pembayaran Parsial pada Formulir Pemesanan
Sistem SHALL mengizinkan input nominal pembayaran yang lebih kecil daripada total harga pesanan, menandai status pembayaran sebagai `PARTIAL`, dan mencatat sisa piutang tanpa memblokir navigasi penyelesaian form.

#### Scenario: Orang tua membayar uang muka sebagian
- **WHEN** orang tua memasukkan nominal bayar Rp 200.000 untuk paket buku seharga Rp 500.000 dan menekan tombol konfirmasi
- **THEN** pesanan berhasil dibuat dengan status bayar `PARTIAL`, nominal terbayar Rp 200.000, dan sisa piutang tercatat Rp 300.000

### Requirement: Diskresi Finance Potong Harga
Sistem SHALL menyediakan aksi bagi peran Finance untuk memberikan potongan harga khusus (diskon/subsidi) pada pesanan siswa dengan kewajiban mengisi alasan dan nama penanggung jawab.

#### Scenario: Finance memberikan potongan harga
- **WHEN** user Finance memasukkan potongan harga Rp 100.000 dengan catatan "Keringanan yayasan" pada pesanan yang belum lunas
- **THEN** total tagihan pesanan disesuaikan berkurang Rp 100.000 dan catatan diskresi tersimpan pada audit trail pesanan

### Requirement: Diskresi Finance Gratis Penuh (Beasiswa/Afirmasi)
Sistem SHALL menyediakan opsi diskresi bebas bayar 100% sehingga sisa tagihan menjadi nol dan status pembayaran menjadi `WAIVED` / Beasiswa.

#### Scenario: Finance menyetujui beasiswa 100%
- **WHEN** user Finance memilih diskresi "Gratis Penuh / Beasiswa" untuk siswa yang bersangkutan
- **THEN** tagihan menjadi Rp 0, status pemesanan terbebas dari piutang, dan buku dapat diserahkan langsung oleh petugas gudang

### Requirement: Diskresi Finance Dispensasi Izin Ambil Buku
Sistem SHALL menyediakan toggle dispensasi pengambilan buku yang memungkinkan serah terima buku fisik kepada siswa meskipun status pembayaran masih `PARTIAL` atau `PENDING`.

#### Scenario: Buku diserahkan sebelum pembayaran lunas berkat diskresi
- **WHEN** pesanan siswa berstatus `PARTIAL` namun telah disetujui izin ambilnya oleh Finance (`finance_handover_approved = true`)
- **THEN** petugas serah terima buku dapat menyelesaikan proses serah terima fisik (handover) tanpa diblokir oleh validasi pelunasan sistem
