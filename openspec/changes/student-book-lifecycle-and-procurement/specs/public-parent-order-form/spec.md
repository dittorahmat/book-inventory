## Purpose

Menyediakan portal formulir web publik bagi orang tua murid untuk mencari data anak, mendeteksi status kenaikan kelas atau pendaftaran murid baru, memilih paket buku, serta mengajukan jalur reguler maupun beasiswa.

## ADDED Requirements

### Requirement: Pencarian dan Deteksi Otomatis Siswa
Sistem SHALL menyediakan fitur pencarian publik berdasarkan NIS atau potongan nama siswa secara responsif dan aman tanpa mewajibkan akun login.

#### Scenario: Siswa lama terdeteksi dan status kenaikan kelas diidentifikasi
- **WHEN** Orang tua mengetik "Hendra Wahyudi" dan memilih profil siswa yang cocok
- **THEN** Sistem menampilkan ringkasan data siswa, mendeteksi kelas tujuan (naik kelas), dan merekomendasikan paket buku yang sesuai dengan tingkat kelas barunya

#### Scenario: Siswa baru diarahkan ke form pendaftaran data baru
- **WHEN** Orang tua mencari nama atau NIS dan tidak menemukan data siswa dalam sistem
- **THEN** Sistem menampilkan opsi dan memandu orang tua mengisi formulir identitas siswa baru yang ditandai dengan status "Menunggu Konfirmasi Sekolah"

### Requirement: Pengajuan Pemesanan Jalur Beasiswa
Sistem SHALL menyediakan opsi jalur beasiswa yang memberikan diskon 100% pada total tagihan buku dan mewajibkan pengunggahan bukti dokumen atau surat tanda beasiswa.

#### Scenario: Pengajuan jalur beasiswa berhasil dikirim
- **WHEN** Orang tua memilih opsi "Jalur Beasiswa", melampirkan berkas foto surat keterangan beasiswa, dan menekan submit
- **THEN** Sistem membuat pesanan dengan status pembayaran "scholarship_pending", total tagihan buku menjadi 0 (diskon 100%), dan mengirim notifikasi email konfirmasi penerimaan pengajuan
