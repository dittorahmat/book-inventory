# Rekonsiliasi Pengambilan Buku Portal Publik

Aplikasi pemesanan buku difungsikan sebagai **self-service confirmation & reconciliation ledger**, bukan gerbang penolakan kasir yang memblokir penyerahan fisik murid.

## Context & Problem Statement

Sebelumnya, pengiriman pesanan buku dari portal publik (`/api/public/orders/submit`) menerapkan asumsi bahwa klaim pembayaran oleh orang tua/wali murid selalu berstatus `unpaid` hingga diverifikasi oleh admin gudang/keuangan. Dampaknya:
1. Orang tua yang telah mentransfer lunas tetap melihat status `unpaid` pada pesanan dan Bukti Pengambilan.
2. Penyerahan fisik buku di sekolah cabang (`/handover`) diblokir keras dengan HTTP 400 bila status pesanan belum `paid` atau tidak memiliki flag diskresi finance khusus.
3. Orang tua yang melakukan pembayaran cicilan/parsial terhalang mengambil buku fisik padahal membawa Bukti Pengambilan resmi.

## Considered Options

- **Verifikasi Kasir Sentralistik (Lama)**: Menahan status order tetap `unpaid` dan menahan buku fisik hingga diverifikasi manual (ditolak: menghambat distribusi fisik buku di cabang dan menimbulkan friksi antrian murid/wali).
- **Rekonsiliasi Pengambilan Mandiri (Dipilih)**: 
  - Pembayaran dengan nominal alokasi transfer setara/lebih tagihan langsung diakui lunas (`paid`).
  - Pembayaran dengan alokasi sebagian langsung dicatat sebagai cicilan (`partial`).
  - Dokumen beasiswa yang valid langsung disetujui (`scholarship_approved`).
  - Serah terima buku fisik di cabang (`/handover`) diizinkan untuk seluruh pemegang Bukti Pengambilan yang berstatus `paid`, `partial`, `scholarship_approved`, atau pesanan berdiskresi finance. Sistem menerbitkan Surat Jalan Penyerahan (`SJ-SERAH`) untuk dasar rekonsiliasi stok fisik versus penerimaan kas.

## Consequences

- Pesanan yang berstatus `partial` tercatat transparan dengan sisa tagihan yang jelas, sehingga tim finance dapat merekonsiliasi pembayaran lanjutan tanpa menahan hak belajar murid menerima buku.
- Status `unpaid` murni (tanpa bukti bayar dan tanpa diskresi finance) tetap ditolak serah terimanya oleh sistem sebagai proteksi keamanan minimal.
- Seluruh dokumen Berita Acara dan audit stok (`term-reconciliation`) tetap server-authoritative.
