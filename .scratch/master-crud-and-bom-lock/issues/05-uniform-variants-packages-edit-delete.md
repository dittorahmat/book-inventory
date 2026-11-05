# 05: Edit & Delete Varian Seragam Satuan & Paket Seragam

**What to build:**
Pengguna staf Central Admin / Logistik Seragam dapat mengedit katalog seragam satuan (Varian Seragam: Nama, Kode, Jenjang, Gender, Harga, URL Size Chart, Deskripsi, serta Daftar Ukuran Aktif) dan Paket Seragam (Komposisi varian dalam paket, harga paket, deskripsi) melalui antarmuka modal edit di tampilan Seragam (`UniformView`). Penghapusan ukuran atau varian seragam dilindungi guard stok dan pesanan: admin dicegah menghapus ukuran seragam jika saldo stok fisik di gudang pusat (`uniform_stock`) lebih dari 0 atau terdapat pesanan seragam pending yang memilih ukuran tersebut. Paket seragam yang telah memiliki riwayat pesanan seragam juga dilindungi dari penghapusan permanen.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Endpoint backend `PUT /api/uniforms/variants/:id` dan `PUT /api/uniforms/packages/:id` tersedia dan tervalidasi skema Zod.
- [ ] Modal Edit Varian Seragam di `UniformView` (Tab Katalog Seragam Satuan) memuat data eksisting dan mengizinkan pembaruan detail varian serta penambahan ukuran baru.
- [ ] Guard Pengurangan Ukuran & Hapus Varian: sistem menolak penghapusan ukuran atau varian jika saldo stok fisik di `uniform_stock` > 0 atau terikat pada pesanan seragam yang belum selesai (`uniform_orders`).
- [ ] Modal Edit Paket Seragam di `UniformView` (Tab Paket Seragam) mengizinkan pembaruan nama paket, harga, dan komposisi varian seragam.
- [ ] Tombol Delete Paket Seragam mengecek ketiadaan pesanan terkait sebelum mengizinkan hard delete.
- [ ] Automated tests memverifikasi endpoint edit varian, edit paket seragam, serta guard proteksi stok/pesanan saat delete.
