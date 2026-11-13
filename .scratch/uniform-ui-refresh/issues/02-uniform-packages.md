# 02: refactor(uniform-packages): Bundling Card dengan Expandable BOM Drawer & Search

**What to build:**
Merestrukturisasi tampilan modul "Paket & Rakit Seragam" agar mengadopsi pola PackageCard Gudang Buku: kartu paket yang bersih, form search untuk mencari nama/kode paket seragam, metrik stok siap kirim terpadu, dan rincian komponen bahan BOM yang dapat di-expand/collapse (accordion), bukan digelar terbuka puluhan card di dalam card.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Toolbar dilengkapi dengan form search paket berdasarkan nama atau kode paket.
- [ ] Kartu paket seragam menampilkan header ringkas: Nama paket, kode, kelas/TA, harga bundling, dan status stok siap kirim.
- [ ] Daftar komponen bahan BOM ditempatkan dalam akordeon (Expand/Collapse BOM Drawer) sehingga tampilan default tetap ringkas dan tidak memanjang ke bawah.
- [ ] Baris input kuantitas & aksi rakit paket terintegrasi di kartu secara clean.
- [ ] Empty state dan modal buat/edit paket tetap bekerja dengan lancar.
