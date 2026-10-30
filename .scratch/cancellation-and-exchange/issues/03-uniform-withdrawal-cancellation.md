# 03: Portal Siswa Mundur: Pembatalan & Retur Fisik Seragam ke Gudang Pusat

**What to build:**
Form pembatalan seragam di portal menampilkan kartu alamat Gudang Pusat. Ortu wajib upload Surat Pengunduran Diri + resi pengiriman kurir retur. Dashboard review Gudang untuk konfirmasi penerimaan fisik seragam retur (menambah stok gudang pusat) dan menerbitkan Slip Bukti Pengembalian Seragam (`RET-U-*`) untuk klaim refund Finance.

**Blocked by:**
01-warehouse-return-address

**Status:** ready-for-agent

- [ ] Kolom/tabel pendukung retur seragam pengunduran diri
- [ ] Endpoint submit pembatalan seragam publik dengan resi kurir & surat mundur
- [ ] Endpoint gudang konfirmasi fisik diterima + mutasi stok masuk ke gudang pusat
- [ ] Penerbitan Slip Bukti Pengembalian Seragam (`RET-U-*`)
- [ ] UI Form portal + kartu alamat gudang + UI review gudang seragam
- [ ] Unit & integration tests hijau
