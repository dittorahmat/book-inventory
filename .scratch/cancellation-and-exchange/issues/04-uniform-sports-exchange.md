# 04: Portal Penukaran Seragam Olahraga (Tukar Ukuran / Salah Kirim)

**What to build:**
Form pengajuan penukaran seragam olahraga di portal: pilih item, ukuran baru/jenis, alasan (salah kirim/salah ukuran), kartu alamat retur gudang, dan upload resi retur. Dashboard verifikasi Gudang saat fisik tiba: deteksi otomatis ketersediaan stok ukuran pengganti, opsi "Ready Stock" (input resi baru) vs "Backorder" (input estimasi tanggal kirim / ETA). Status tracking penukaran di portal ortu menampilkan progres verifikasi resi & tanggal estimasi pengiriman pengganti.

**Blocked by:**
01-warehouse-return-address

**Status:** ready-for-agent

- [ ] Integrasi ke skema/seam `uniform_exchanges` dengan field estimasi tanggal kirim (`estimatedShipDate`) & status backorder
- [ ] Endpoint publik submit penukaran seragam olahraga dengan resi retur
- [ ] Endpoint gudang review terima retur & deteksi stok pengganti otomatis
- [ ] Input resi kirim baru atau input tanggal estimasi kirim ke ortu
- [ ] UI Form di portal ortu & tracking status penukaran
- [ ] Unit & integration tests hijau
