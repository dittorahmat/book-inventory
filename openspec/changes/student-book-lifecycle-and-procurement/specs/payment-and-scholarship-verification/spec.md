## Purpose

Memfasilitasi staf keuangan dan kasir sekolah dalam memverifikasi bukti transfer pembayaran (lunas maupun cicilan/parsial), mencatat porsi pembayaran buku dari transfer gabungan, serta memvalidasi pengajuan beasiswa siswa.

## ADDED Requirements

### Requirement: Verifikasi Pembayaran Parsial dan Lunas
Sistem SHALL mendukung penerimaan bukti transfer dengan input konfirmasi nominal alokasi buku secara bebas (*free-text / numeric*). Unggahan bukti oleh orang tua SHALL hanya membuat klaim berstatus menunggu (*pending*) dan TIDAK mengubah status pembayaran pesanan; status pembayaran hanya berubah menjadi lunas (*paid*) atau parsial (*partial*) setelah staf memverifikasi klaim tersebut.

#### Scenario: Klaim bukti transfer berstatus menunggu
- **WHEN** Orang tua mengunggah bukti transfer melalui form pemesanan atau tautan konfirmasi pembayaran
- **THEN** Sistem mencatat klaim pembayaran berstatus "pending" dan status pembayaran pesanan tetap "unpaid" dengan sisa tagihan tidak berubah

#### Scenario: Pembayaran parsial tercatat dengan sisa tagihan
- **WHEN** Orang tua mengunggah bukti transfer gabungan Rp 5.000.000 dan menginput alokasi buku sebesar Rp 800.000 dari total tagihan buku Rp 1.500.000, lalu staf menekan tombol "Verifikasi"
- **THEN** Kasir memverifikasi pembayaran, sistem mencatat nominal terbayar Rp 800.000, menandai status pembayaran sebagai "partial", dan menampilkan sisa tagihan Rp 700.000

#### Scenario: Bukti ditolak dengan tautan unggah ulang
- **WHEN** Staf menolak klaim bukti transfer dengan menyertakan alasan
- **THEN** Sistem menandai klaim "rejected" beserta alasannya, TIDAK mengkredit nominal apa pun, dan mengirim notifikasi ke orang tua berisi alasan serta tautan yang sama untuk mengunggah ulang tanpa membuat pesanan baru

#### Scenario: Pembayaran lunas
- **WHEN** Kasir memverifikasi bukti transfer dengan alokasi buku memenuhi atau melampaui sisa tagihan buku
- **THEN** Sistem menandai status pembayaran sebagai "paid" (lunas) dan membuka status paket buku menjadi siap diproses untuk penyerahan

### Requirement: Verifikasi dan Persetujuan Beasiswa
Sistem SHALL menyediakan antarmuka bagi staf yang berwenang untuk meninjau berkas surat beasiswa dan menyetujui atau menolak permohonan beasiswa.

#### Scenario: Persetujuan beasiswa disahkan
- **WHEN** Staf administrasi memeriksa keabsahan surat keterangan beasiswa dan menekan tombol "Setujui Beasiswa"
- **THEN** Sistem memperbarui status pesanan menjadi "scholarship_approved" tanpa tagihan tertunggak dan mengubah status buku menjadi siap dipersiapkan untuk penyerahan
