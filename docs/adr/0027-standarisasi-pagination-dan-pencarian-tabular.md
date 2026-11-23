# Standarisasi Pagination dan Pencarian Tabular Operasional

## Konteks
Sebagian besar tampilan tabular dan daftar data di aplikasi (seperti Pesanan Buku/Siswa, Pesanan Seragam, Pengadaan/PO, Mutasi Retur, dan Surat Jalan Transfer) belum memiliki pagination terstandarisasi, melainkan merender seluruh baris sekaligus. Hanya modul Siswa (`StudentsView`) yang memiliki pagination lengkap di sisi server. Seiring dengan peningkatan volume transaksi di basis data Cloudflare D1, rendering seluruh dataset secara sekaligus membebani performa browser (DOM nodes bloat), meningkatkan payload jaringan, dan memperbesar risiko query D1 meluap.

## Keputusan
1. **Lingkup Pembatasan Pagination**: Pagination diwajibkan secara tegas pada tabel-tabel transaksi operasional bervolume tinggi yang terus bertumbuh (`StudentOrdersView`, `UniformShipmentSection` / pesanan seragam, `PurchaseOrdersTable`, `ShipmentLinesTable`, `BookReturnsView`, dan daftar stok/katalog). Tabel master data berukuran kecil/sedang (< 100 baris seperti `SettingsView` untuk sekolah/pengguna, atau drawer breakdown analitik) tetap diizinkan tanpa pagination guna menjaga kelancaran interaksi satu layar.
2. **Strategi Arsitektur Bertingkat**:
   - **Server-Side Pagination**: Diterapkan pada endpoint query D1 untuk entitas transaksional berpotensi ribuan baris (`orders`, `uniform_orders`) dengan parameter baku `page` (default 1) dan `limit` (default 25 atau 50), mengembalikan amplop metadata `{ page, limit, total, totalPages }`.
   - **Client-Side Reusable Pagination**: Untuk tampilan katalog/gudang yang datanya sudah di-cache terpusat pada sesi klien, pagination dilakukan di sisi frontend menggunakan helper/komponen pemotong baris terpadu (`TablePagination.tsx`).
3. **Pola Debounce dan Auto-Reset Pencarian**: Setiap input pencarian (*search bar*) wajib menerapkan debouncing ~300ms sebelum memicu pemfilteran/query, dan wajib secara otomatis mereset halaman aktif kembali ke `page = 1` untuk mencegah kondisi pointer halaman berada di luar total halaman hasil filter.
4. **Komponen UI Kanonik**: Navigasi halaman disatukan ke dalam satu komponen kanonik (`TablePagination`) yang menampilkan rincian baris ("Menampilkan baris X - Y dari total Z data"), tombol Previous/Next berstatus disabled sesuai posisi batas, serta indikator nomor halaman.
