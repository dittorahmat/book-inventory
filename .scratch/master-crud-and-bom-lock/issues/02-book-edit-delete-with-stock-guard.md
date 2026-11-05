# 02: Edit & Delete Buku Satuan dengan Guard Eksemplar Fisik & BOM

**What to build:**
Pengguna staf Central Admin / Logistik Buku dapat memperbarui informasi katalog buku satuan (Judul Buku, Judul Publik Samaran, ISBN, Jenjang Kelas, Kurikulum, Harga Beli/Dasar, Harga Jual Efektif, dan Penugasan Pemasok/Supplier) langsung dari tampilan Gudang Buku (Tab Katalog Master Buku). Penghapusan buku dilindungi oleh guard dependensi: sistem menolak penghapusan buku yang telah memiliki unit eksemplar fisik di rak cabang/gudang pusat (`book_items`) atau masih terdaftar sebagai komponen paket aktif (`book_package_items`), sehingga stok fisik tidak menjadi yatim (orphan stock).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Modal Edit Buku dapat dibuka dari tabel katalog buku di tampilan Gudang Buku (`BookWarehouseView`), memuat data eksisting buku beserta supplier terkait, dan menyimpan perubahan via endpoint `PATCH /api/books/:id`.
- [ ] Perubahan harga master buku tersimpan dengan benar dan berlaku efektif untuk pemesanan baru tanpa memengaruhi snapshot harga pesanan berjalan lama.
- [ ] Tombol Delete Buku memverifikasi ketiadaan relasi fisik: menolak penghapusan dengan pesan error jelas jika ada saldo/eksemplar `book_items` atau buku terikat di dalam `book_package_items`.
- [ ] Buku baru yang belum pernah dirakit/didaftarkan eksemplarnya dapat dihapus permanen secara bersih.
- [ ] Automated tests memverifikasi fungsionalitas edit dan proteksi delete buku yang memiliki relasi.
