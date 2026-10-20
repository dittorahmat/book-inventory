# Spec Delta

## MODIFIED Requirements

### Requirement: Dukungan Pembayaran Parsial pada Formulir Pemesanan
Sistem SHALL mengizinkan input nominal pembayaran yang lebih kecil daripada total harga pesanan dan mencatatnya sebagai klaim pembayaran berstatus menunggu verifikasi (*pending*) tanpa memblokir navigasi penyelesaian form. Status pembayaran pesanan baru berubah menjadi `PARTIAL`/`PAID` setelah gudang memverifikasi klaim tersebut, dengan batasan tanggung jawab rilis barang fisik oleh gudang hanya berlaku pada pembayaran pertama (DP) yang didukung bukti bayar dan dokumen pendukung.

#### Scenario: Orang tua mengajukan uang muka sebagian
- **WHEN** orang tua memasukkan nominal bayar Rp 200.000 untuk paket buku seharga Rp 500.000 dan menekan tombol konfirmasi
- **THEN** pesanan berhasil dibuat dengan status bayar `UNPAID`, klaim pembayaran Rp 200.000 berstatus menunggu verifikasi, dan sisa piutang tetap Rp 500.000 sampai gudang memverifikasi klaim

#### Scenario: Gudang memverifikasi klaim uang muka
- **WHEN** gudang memverifikasi klaim Rp 200.000 pada pesanan Rp 500.000
- **THEN** status bayar menjadi `PARTIAL`, nominal terbayar Rp 200.000, dan sisa piutang Rp 300.000

## ADDED Requirements

### Requirement: Penentuan Persentase Diskon Beasiswa Parsial oleh Logistik
Sistem SHALL menyediakan antarmuka bagi tim logistik untuk menginput persentase diskon beasiswa parsial pada siswa yang berhak, serta menahan penerbitan tagihan final sampai persentase diskon tersebut diverifikasi dan dimasukkan oleh logistik.

#### Scenario: Logistik memasukkan diskon beasiswa parsial
- **WHEN** siswa mengajukan beasiswa parsial dan petugas logistik memasukkan nilai diskon 40% beserta nomor SK/catatan beasiswa
- **THEN** sistem menghitung ulang tagihan final siswa menjadi 60% dari harga normal dan membuka akses pembayaran bagi siswa/wali murid

#### Scenario: Tagihan terkunci sebelum input diskon logistik
- **WHEN** siswa terdaftar pada jalur beasiswa parsial namun logistik belum menginput persentase diskon
- **THEN** portal pembayaran menampilkan status "Menunggu Konfirmasi Diskon Logistik" dan menahan transaksi pembayaran sampai diskon diverifikasi

### Requirement: Batasan Tanggung Jawab Gudang atas Cicilan Beasiswa Parsial
Sistem SHALL membatasi tanggung jawab operasional rilis barang fisik oleh gudang hanya pada verifikasi pembayaran cicilan pertama (beserta bukti beasiswa), sedangkan penagihan dan pencatatan cicilan tahap berikutnya dikelola secara independen di luar wewenang gudang logistik.

#### Scenario: Gudang merilis buku atas cicilan pertama beasiswa parsial
- **WHEN** siswa beasiswa parsial telah menyelesaikan pembayaran cicilan pertama dan mengunggah bukti bayar serta bukti beasiswa
- **THEN** petugas gudang memverifikasi kedua bukti tersebut dan sistem mengizinkan penyerahan paket buku kepada siswa tanpa mewajibkan pelunasan penuh cicilan di sisi gudang
