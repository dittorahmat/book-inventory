## Why

Aplikasi saat ini hanya menangani pergerakan stok dasar antar gudang sekolah. Sekolah membutuhkan perombakan bisnis proses end-to-end yang mencakup pengadaan buku dari supplier (PO), manajemen stok bertingkat (buku satuan / loose stock dan perakitan paket buku / bundle), portal formulir publik bagi orang tua murid (deteksi siswa lama vs siswa baru, jalur reguler vs beasiswa), verifikasi pembayaran kasir (lunas/parsial/cicilan), alur surat jalan dan serah terima buku, penanganan retur buku rusak/cacat, serta notifikasi terotomasi via email SMTP.

## What Changes

- **Master Buku Satuan & Paket**: Memperkenalkan konsep BOM (Bill of Materials) di mana buku fisik terdiri dari buku satuan (lokal dan internasional seperti Cambridge/Agama/dsb) yang dapat dirakit (*bundling*) menjadi paket kelas tertentu dan dibongkar (*unbundling*) kembali secara transaksional.
- **Formulir Publik Pemesanan Buku Orang Tua**: Antarmuka publik yang responsif tanpa login wajib, dilengkapi pencarian nama/NIS cerdas. Otomatis mendeteksi siswa naik kelas atau memandu pendaftaran siswa baru.
- **Jalur Beasiswa & Formulir Khusus**: Formulir khusus beasiswa dengan diskon 100% dan kewajiban mengunggah bukti/surat keterangan beasiswa yang memerlukan verifikasi admin sekolah.
- **Manajemen Pembayaran Fleksibel**: Mendukung pembayaran penuh (lunas) maupun parsial/cicilan, dilengkapi kolom konfirmasi nominal alokasi buku dari bukti transfer gabungan (misal gabungan SPP + buku).
- **Dashboard Operasional Siswa & Pembayaran**: Matriks pelacakan status pembayaran (Unpaid, Partial, Paid, Scholarship Pending/Approved) dan status fisik buku (Waiting Preparation, Ready for Pickup, Picked Up, Return/Replacement).
- **Surat Jalan & Retur Buku**: Pembuatan surat jalan/bukti serah terima siswa serta pelacakan retur buku cacat dengan lampiran foto bukti.
- **Pengadaan Supplier (Purchase Order)**: Alur PO supplier mulai dari pembuatan draft, dispatch, hingga penerimaan barang masuk ke stok satuan.
- **Integrasi Email SMTP**: Modul konfigurasi SMTP dan pengiriman email konfirmasi pemesanan, verifikasi pembayaran, dan info kesiapan pengambilan paket ke orang tua siswa.
- **Perombakan Total Data Demo**: Reset dan pengisian ulang data seed komprehensif yang memuat profil sekolah, supplier, master buku satuan & paket, siswa demo (lama & baru), pesanan dalam aneka status simulasi, serta histori stok.

## Capabilities

### New Capabilities
- `book-package-and-bundling`: Pengelolaan master paket buku, komponen BOM buku satuan, serta mekanisme transaksi assembly (bundling) dan disassembly (unbundling).
- `public-parent-order-form`: Portal formulir publik orang tua untuk pencarian siswa, deteksi naik kelas, pendaftaran siswa baru, pemilihan paket, dan alur beasiswa.
- `payment-and-scholarship-verification`: Verifikasi pembayaran lunas/parsial kasir, verifikasi alokasi nominal buku dari transfer gabungan, dan persetujuan surat beasiswa.
- `dashboard-student-fulfillment`: Dashboard matriks status pembayaran dan penyerahan buku, surat jalan serah terima, serta alur komplain/retur buku cacat.
- `procurement-supplier-po`: Manajemen pengadaan buku dari supplier melalui Purchase Order (PO) dan penerimaan barang ke gudang stok satuan.
- `email-notification-smtp`: Pengaturan SMTP dinamis dan pengiriman email transaksional untuk rincian pemesanan, pembayaran, dan penyerahan buku.
- `comprehensive-demo-data`: Data demo yang dirombak total menyajikan skenario realistis siswa lama, siswa baru, aneka status pembayaran, dan pengadaan.

### Modified Capabilities
<!-- Tidak ada modified capabilities karena project belum memiliki main specs aktif sebelumnya -->

## Impact

- **Database Schema**: Perluasan skema Drizzle di `src/db/schema.ts` (tabel master paket, komponen paket, siswa, pemesanan buku, item pemesanan, bukti pembayaran/beasiswa, retur buku, supplier, purchase orders, dan pengaturan SMTP).
- **Backend API Routes**: Penambahan rute baru di `src/server/routes/` untuk paket, form publik, pesanan, verifikasi pembayaran, PO supplier, surat jalan, dan email SMTP.
- **Frontend Views & Components**: Penambahan halaman portal publik orang tua (`/order`), dashboard matriks serah terima & kasir, antarmuka manajemen bundling/kitting stok, dan modul PO supplier.
- **Email Service**: Integrasi nodemailer atau SMTP client kompatibel Cloudflare Workers / Node runtime.
- **Seed & Demo**: Modifikasi total `src/server/routes/demo.ts` dan test suite terkait.
