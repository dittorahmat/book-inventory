# 01: Skema Status superseded & Seam Pelepasan Alokasi Stok Atomik

**What to build:**
Menambahkan dukungan status `superseded` dan referensi pengganti pada pesanan buku dan seragam, serta menyediakan fungsi transaksional atomik untuk melepas ikatan stok fisik lama kembali ke stok bebas cabang/gudang.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Kolom `supersededByOrderId` atau enum status `superseded` didukung pada model data/skema pesanan buku dan seragam.
- [ ] Seam unassign stok melepaskan `allocatedPackageId` / `allocatedBookId` pesanan buku kembali menjadi stok bebas cabang.
- [ ] Seam unassign stok seragam mengembalikan alokasi seragam fisik ke stok pusat.
- [ ] Unit regression test memastikan stok kembali bertambah/bebas seketika order di-supersede.
