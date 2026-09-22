## Why

Saat ini antarmuka sistem Book Inventory dioptimalkan hanya untuk tampilan desktop/layar lebar. Ketika diakses melalui perangkat seluler (khususnya smartphone Android dengan lebar layar ~360px - 412px), tata letak mengalami degradasi berat: header berhimpitan, tab navigasi horizontal terpotong, tabel data 7-kolom meluap dan tidak terbaca, serta tombol aksi terlalu kecil untuk disentuh (touch targets di bawah 44px).

Pembaruan ini diperlukan agar staf gudang dan admin cabang dapat mengelola stok fisik, memindai barcode buku, dan memantau status transfer antar-cabang langsung dari smartphone Android mereka dengan nyaman, cepat, dan ergonomis.

## What Changes

- **Mobile Header**: Menyesuaikan header utama agar ringkas di layar kecil (`< md`), menyembunyikan detail redundan dan memberikan branch selector yang kompak.
- **Bottom Navigation Bar**: Menambahkan bilah navigasi bawah tetap (*sticky bottom bar*) khusus untuk viewport mobile (`< md`) dengan ikon jelas dan ergonomis untuk jempol tangan satu.
- **Adaptive Card View for Inventory**: Mengubah tampilan daftar buku fisik di `InventoryView` dari tabel kaku multi-kolom menjadi tumpukan kartu informatif (*stacked cards*) di layar mobile, lengkap dengan aksi audit kondisi cepat dan seleksi batch.
- **Adaptive Card View for Transfers & Catalog**: Mengadaptasi tampilan riwayat transfer pengiriman dan katalog buku menjadi format kartu responsif di mobile.
- **Touch-Friendly Controls**: Memperbesar target sentuh (*touch target*) untuk checkbox, tombol aksi, dropdown kondisi, dan form input agar memenuhi standar aksesibilitas minimum (44x44px).
- **Android Safe Area Padding**: Memastikan floating bar dan bottom navigation bar memperhitungkan navigasi gestur bawaan Android (`pb-safe` / `env(safe-area-inset-bottom)`).

## Capabilities

### New Capabilities
- `mobile-responsive-ui`: Antarmuka responsif ramah seluler untuk navigasi bawah, adaptive card view, dan kontrol sentuh ramah jempol pada perangkat mobile.

### Modified Capabilities
<!-- Tidak ada spesifikasi fungsional backend atau model domain yang berubah; perubahan berfokus pada visual/UX presentation layer -->

## Impact

- Frontend: [App.tsx](file:///D:/development/book-inventory/src/App.tsx), [InventoryView.tsx](file:///D:/development/book-inventory/src/views/InventoryView.tsx), [TransfersView.tsx](file:///D:/development/book-inventory/src/views/TransfersView.tsx), [CatalogView.tsx](file:///D:/development/book-inventory/src/views/CatalogView.tsx), serta komponen navigasi.
- Dependencies: Tidak ada penambahan paket eksternal baru (memanfaatkan Tailwind CSS dan Lucide Icons yang sudah tersedia).
- Database & Backend API: Tidak ada perubahan skema database atau endpoint API.
