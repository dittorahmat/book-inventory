## What to build
Mendekopling tampilan dan pemesanan seragam olahraga dari pembatasan pesanan satuan (`satuanOpen`).

Di awal tahun ajaran, seragam olahraga merupakan bagian integral dari seragam sekolah yang wajib dipesan bersamaan dengan paket bahan kain harian. Saat ini, jika admin menutup pesanan satuan (`satuanOpen === false`), antarmuka menyembunyikan form seragam olahraga dan backend melempar error `Pembelian satuan seragam sedang ditutup oleh admin.`

Tiket ini memastikan:
1. Seragam olahraga selalu ditampilkan di antarmuka portal publik (`UniformItemStep.tsx`) tanpa memandang toggle `satuanOpen`.
2. Backend (`orders.ts`) mengizinkan pemesanan varian seragam olahraga ketika dipesan bersama paket seragam (atau untuk intake murid baru di awal tahun), dan guard `isUniformSatuanEnabled` hanya membatasi pembelian eceran/satuan tambahan tanpa paket.

## Acceptance criteria
- [ ] Antarmuka portal publik (`UniformItemStep.tsx`) selalu menampilkan form seragam olahraga dan pilihan ukurannya terlepas dari apakah `order.satuanOpen` aktif atau tidak.
- [ ] Backend (`submitUniformOrder`) mengizinkan pemesanan seragam olahraga (varian `olahraga`) bersama paket bahan kain harian meskipun pengaturan pembelian satuan ditutup oleh admin.
- [ ] Pesanan eceran murni (hanya membeli varian satuan tanpa paket) tetap ditolak jika pembelian satuan ditutup admin.
- [ ] Unit test dan route test memvalidasi skenario pemesanan paket + olahraga saat satuan dinonaktifkan (`satuanOpen: false`).

## Blocked by
- #432
