## Why

Berdasarkan masukan demo operasional dan validasi alur nyata:
1. Pengelolaan data siswa masih kaku (tidak bisa diedit per data dan belum ada fasilitas bulk upload Excel dengan template dan resolusi duplikasi/upsert).
2. Formulir pemesanan siswa portal publik gagal saat pembayaran parsial (DP) karena validasi memblokir jika nominal di bawah harga total, serta belum mendukung diskresi manual Finance (diskon/potong harga, gratis 100%/beasiswa, atau dispensasi izin ambil buku fisik sebelum lunas).
3. Penerimaan barang (inbound PO) dari supplier belum mencatat nomor surat jalan dan belum memvisualisasikan rincian penerimaan bertahap/parsial.
4. Model pengadaan cabang saat ini tidak lagi membutuhkan transfer buku horizontal antarcabang; sebaliknya Cabang melakukan PO Paket internal ke Gudang Pusat dengan pengiriman bertahap (multi surat jalan) tanpa harus membuat PO berulang saat ada buku yang telat datang (outstanding/backorder).
5. Perakitan paket dipusatkan eksklusif di Gudang Pusat dengan dukungan kelengkapan parsial (kit terbuka dengan buku outstanding), dan penjualan buku satuan langsung ke orang tua dilayani di Gudang Pusat.
6. Menu publik retur buku rusak perlu diubah menjadi alur Refund resmi di Gudang Pusat (menambah stok kembali), disertai fitur Refund/Retur ke Supplier (Return to Vendor) untuk mengembalikan buku cacat/kelebihan.
7. Komunikasi konfirmasi pemesanan dan pengiriman PO membutuhkan integrasi WhatsApp berbasis nomor sendiri via sidecar/gateway REST API yang kompatibel dengan Cloudflare Workers.

## What Changes

- **Manajemen Siswa (Edit & Bulk Upload Upsert)**:
  - Dukungan edit data siswa langsung di antarmuka web.
  - Fitur bulk upload Excel/CSV dengan tombol unduh template sampel, validasi baris, dan penanganan duplikasi via upsert berbasis NIS/identitas siswa.
- **Formulir Portal Siswa, Pembayaran Parsial & Diskresi Finance**:
  - Perbaikan form pembayaran siswa agar menerima pembayaran parsial (down payment/angsuran) tanpa memblokir tombol lanjut, otomatis menghitung sisa piutang.
  - Multi-aksi Diskresi Finance pada pesanan siswa:
    1. Potong harga (diskon/subsidi khusus) dengan rekalkulasi tagihan.
    2. Bebas bayar penuh (100% gratis / beasiswa / afirmasi) dengan bypass pembayaran.
    3. Dispensasi serah terima fisik (ACC izin ambil buku meskipun pembayaran belum lunas), membuka gembok handover di gudang.
- **Inbound Supplier dengan Surat Jalan & Penerimaan Parsial**:
  - Formulir penerimaan barang (inbound) mewajibkan input Nomor Surat Jalan Supplier dan tanggal terima.
  - Dukungan penerimaan parsial: satu PO dapat memiliki banyak riwayat Surat Jalan dengan rincian buku dan kuantiti yang diterima di tiap kedatangan.
- **Alur PO Internal Cabang ke Gudang Pusat (Berbasis Paket)**:
  - Cabang menerbitkan PO Internal ke Gudang Pusat khusus per unit Paket (tanpa transfer satuan antarcabang).
  - Satu PO Cabang dapat dipenuhi melalui beberapa kali Surat Jalan Pengiriman Internal (Pusat -> Cabang) tanpa perlu membuat PO kedua saat ada buku yang menyusul.
- **Sentralisasi Perakitan Paket & Kelengkapan Parsial (Outstanding Buku)**:
  - Hak akses perakitan paket hanya tersedia di Gudang Pusat.
  - Dukungan perakitan paket parsial (misal 8 dari 10 buku tiba): sistem mencatat paket terkirim sebagian dan menerbitkan catatan/voucher outstanding buku untuk pengiriman susulan.
  - Penjualan buku satuan langsung ke orang tua dilayani di Gudang Pusat memotong stok satuan non-paket.
- **Refund Orang Tua & Retur ke Supplier (Return to Vendor - RTV)**:
  - Form publik retur buku rusak diubah menjadi alur "Refund Orang Tua" yang dieksekusi di Gudang Pusat (mengembalikan dana dan menambah kembali stok buku).
  - Modul baru Retur ke Supplier (RTV) sebagai kebalikan PO untuk mengembalikan buku rusak/kelebihan ke penerbit/supplier dan mencatat nota kredit.
- **Integrasi WhatsApp Notifikasi (Cloudflare Worker Compatible)**:
  - Abstraksi service notifikasi via REST API HTTP ke sidecar WhatsApp (mendukung scanning QR nomor sendiri tanpa membebani runtime V8 isolate worker).
  - Otomasi pengiriman pesan konfirmasi pesanan siswa dan notifikasi penerbitan PO.

## Capabilities

### New Capabilities
- `student-data-management`: Edit data siswa, bulk upload file Excel/CSV dengan format sampel, dan resolusi duplikasi upsert.
- `finance-discretion-and-partial-payment`: Dukungan pembayaran parsial pada portal siswa dan kontrol diskresi Finance (potong harga, gratis penuh, dan dispensasi izin ambil buku fisik).
- `inbound-delivery-tracking`: Pencatatan nomor surat jalan supplier dan rincian penerimaan barang parsial bertahap pada Purchase Order.
- `branch-internal-procurement`: Siklus hidup PO Internal Cabang ke Gudang Pusat khusus paket dengan pemenuhan multi-surat jalan dan pelacakan outstanding buku.
- `centralized-assembly-and-direct-sale`: Perakitan paket eksklusif di gudang pusat, penanganan paket parsial (outstanding items), dan penjualan buku satuan langsung ke orang tua.
- `refund-and-vendor-return`: Pengembalian dana/buku (refund orang tua) di gudang pusat serta pengembalian barang ke supplier (Return to Vendor).
- `whatsapp-notification-bridge`: Jembatan notifikasi WhatsApp berbasis HTTP gateway/sidecar untuk nomor sendiri yang kompatibel dengan runtime Cloudflare Workers.

### Modified Capabilities
<!-- Tidak ada - openspec/specs saat ini belum memiliki spec dasar -->

## Impact

- **Database Schema**:
  - Kolom surat jalan dan tabel log penerimaan parsial (`purchase_order_receipts` / delivery note tracking).
  - Status diskresi finance (`finance_approval_status`, `discount_amount`, `discretion_notes`, `approved_by`) pada `student_book_orders`.
  - Tabel/status PO internal cabang (`internal_orders` / `internal_shipments`).
  - Pencatatan outstanding package items dan nota retur supplier (`vendor_returns`).
- **Backend & APIs**:
  - Modul impor data siswa (parsing Excel/CSV dan batch upsert D1).
  - Endpoint PO internal, Surat Jalan pengiriman, dan pemenuhan susulan.
  - Endpoint diskresi finance & refund buku.
  - WhatsApp notification client HTTP abstraction.
- **Frontend Views**:
  - Halaman Siswa: Edit modal & Excel bulk upload wizard + template download.
  - Form Pemesanan Siswa & Kasir: Dukungan partial payment dan tombol diskresi Finance.
  - Halaman Inbound/PO: Form input No Surat Jalan dan visual timeline kedatangan parsial.
  - Halaman Cabang: Form PO Paket ke Pusat & pelacakan status surat jalan / buku outstanding.
  - Halaman Retur/Refund: Form refund di gudang pusat & pengajuan RTV ke supplier.
