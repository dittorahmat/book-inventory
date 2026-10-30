# 02: Portal Siswa Mundur: Pembatalan Buku & Pelepasan Stok Otomatis

**What to build:**
Form pembatalan buku oleh ortu di halaman status pesanan dengan unggah Surat Pengunduran Diri. Dashboard review Gudang untuk persetujuan pembatalan buku: jika buku belum diambil (`!handover`), pesanan cancel dan alokasi paket/buku satuan di cabang otomatis di-unassign menjadi stok bebas (`available`). Menerbitkan Slip Bukti Pengembalian Buku (`RET-B-*`) untuk dibawa ortu ke Finance.

**Blocked by:**
01-warehouse-return-address

**Status:** ready-for-agent

- [ ] Kolom/tabel pendukung pengunduran diri & dokumen surat pengunduran diri
- [ ] Endpoint submit pengajuan pembatalan buku publik (`/api/public/orders/cancel-withdrawal`)
- [ ] Endpoint approval gudang (`/api/orders/:id/cancel-withdrawal-approve`)
- [ ] Unassign otomatis paket & buku satuan menjadi stok bebas di cabang
- [ ] Penerbitan nomor Slip Bukti Pengembalian Buku (`RET-B-*`)
- [ ] UI Form di status pesanan + UI review di tab Gudang
- [ ] Regression & contract tests hijau
