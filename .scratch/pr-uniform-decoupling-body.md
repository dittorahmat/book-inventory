## Ringkasan Perubahan
PR ini menyelesaikan masalah pada portal pemesanan seragam publik di mana paket kain harian tidak muncul dan seragam olahraga tersembunyi/terblokir saat pembelian satuan ditutup admin:

1. **Sinkronisasi Katalog & Paket Kain ke Remote D1 Production (closes #432)**:
   - 80 varian seragam, ukuran olahraga, 8 paket bundling bahan kain harian (TK/SD/SMP/SMA Ikhwan & Akhwat), dan 72 BOM item telah disinkronkan ke database Cloudflare D1 remote (`book-inventory-db`).
   - Endpoint `/api/public/uniform-orders/catalog` di production kini mengembalikan katalog paket kain harian yang lengkap (`packages: 8`, `variants: 80`).

2. **Dekopling Seragam Olahraga dari Guard Satuan (closes #433)**:
   - Di UI (`UniformItemStep.tsx`): Seragam olahraga jenjang siswa kini selalu ditampilkan dan dapat dipilih ukurannya tanpa bergantung pada status toggle `satuanOpen`.
   - Di hook (`useUniformOrder.ts`): Siswa yang dipilih otomatis disiapkan kuantitas 1 paket kain harian dan 1 pasang olahraga matching jenjang & gender.
   - Di backend (`orders.ts`): Guard `isUniformSatuanEnabled` diperbaiki agar seragam olahraga konveksi tetap dapat dipesan bersamaan dengan paket bahan kain harian di awal tahun ajaran, dan hanya membatasi pesanan eceran murni tanpa paket jika pembelian satuan ditutup admin.
   - Unit test komponen & route test ditambahkan untuk memvalidasi bahwa paket + seragam olahraga tetap sukses disubmit saat toggle satuan nonaktif.
