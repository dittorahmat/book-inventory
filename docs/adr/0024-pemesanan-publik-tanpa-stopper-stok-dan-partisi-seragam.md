# ADR-0024: Pemesanan Publik Tanpa Stopper Stok, Konfigurasi Peringatan Stok Menipis, dan Partisi Ukuran Seragam

## Konteks
Sebelumnya, sistem pemesanan seragam di portal publik memblokir pembuatan pesanan ketika stok paket rakitan atau stok varian satuan bernilai nol (`checkUniformAvailability` mengembalikan error `Stok paket rakitan belum cukup` atau `Stok satuan tidak cukup`). Selain itu, angka sisa stok fisik masih ditampilkan ke publik di portal orang tua, pemilihan ukuran Khimar SD belum memiliki pre-seleksi otomatis berdasarkan kelas, dan dropdown ukuran seragam olahraga menampilkan ukuran lintas jenjang.

Untuk kelancaran intake penerimaan murid baru (PPDB) dan awal tahun ajaran, orang tua murid harus dapat memesan seragam dan buku tanpa terhalang stok fisik gudang yang sedang berproses di konveksi/penerbit, angka stok publik harus disembunyikan (menjadi urusan logistik), serta staf logistik membutuhkan sistem ambang batas peringatan stok menipis (*low stock warning*) yang dapat dikonfigurasi.

## Keputusan
1. **Pemesanan Publik Tanpa Stopper Stok**:
   - Saldo stok 0 (atau kurang dari permintaan) tidak lagi menjadi stopper checkout di portal pemesanan publik (`publicUniformOrdersRouter` dan intake buku).
   - Pesanan tetap dibuat dan tercatat sah dengan status pengiriman `belum_dikirim` (dan `fulfillmentStatus = 'waiting_preparation'` untuk buku).
   - Penyesuaian stok fisik gudang tetap berjalan secara aman tanpa menyebabkan error kegagalan pesanan, sehingga pemenuhan barang yang belum siap sepenuhnya dikelola dalam antrean logistik/pengadaan.
2. **Penyembunyian Data Stok Publik & Warning Rendah**:
   - Menghapus tampilan nominal angka stok (`Stok: X`, `Siap kirim: X`) dari antarmuka orang tua di portal publik seragam dan buku.
   - Menyediakan indikator teks ramah/halus di portal publik jika stok berada di bawah batas tertentu bahwa pesanan diproses mengikuti antrean persediaan.
3. **Ambang Batas Stok Menipis Terpusat (Configurable Low Stock Threshold)**:
   - Dikelola di `system_settings` dengan kunci kanonik:
     - `low_stock_threshold_book`: Ambang batas buku satuan (default: 10)
     - `low_stock_threshold_book_package`: Ambang batas paket buku (default: 5)
     - `low_stock_threshold_uniform_variant`: Ambang batas varian seragam satuan/olahraga (default: 5)
     - `low_stock_threshold_uniform_package`: Ambang batas paket seragam (default: 5)
   - Digunakan untuk dashboard logistik/admin dalam memicu status peringatan *Low Stock*.
4. **Pre-seleksi Ukuran Khimar SD**:
   - Siswa perempuan jenjang SD otomatis terpilih ukuran Khimar SD sesuai kelasnya:
     - Kelas 1 & 2 $\rightarrow$ Size 1
     - Kelas 3, 4, 5, 6 $\rightarrow$ Size 4
   - Berlaku saat inisialisasi form pemesanan portal maupun alur create varian/intake massal. Dropdown ukuran tetap dapat diganti jika postur anak berbeda.
5. **Partisi Ukuran Seragam Olahraga & Size Chart per Jenjang**:
   - Dropdown pilihan ukuran seragam olahraga difilter secara ketat hanya menampilkan ukuran resmi jenjang murid bersangkutan berdasarkan standar size chart Al-Wildan (`src/lib/uniform-size-chart.ts`):
     - TK: S, M, L, XL
     - SD: S, M, L, XL, 2XL, 3XL, 4XL
     - SMP/SMA: S, M, L, XL, 2XL, 3XL, 4XL, 5XL
   - Modal panduan ukuran (*size chart guide*) hanya menampilkan tabel jenjang murid tersebut.

## Konsekuensi
- Orang tua tidak lagi terganggu oleh batasan stok fisik saat melakukan pemesanan.
- Logistik pusat mengandalkan laporan antrean order dan indikator low stock untuk memicu PO konveksi/penerbit (Purchase Order Demand).
- Ukuran seragam olahraga dan Khimar SD menjadi presisi dan minim salah pilih dari pihak orang tua.
