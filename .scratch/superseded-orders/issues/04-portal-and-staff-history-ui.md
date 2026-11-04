# 04: Visualisasi Riwayat Portal Publik & Audit Trail Staf

**What to build:**
Tampilan riwayat pesanan bagi orang tua di portal publik yang menyajikan pesanan aktif terbaru sebagai kartu utama dan pesanan bertanda `superseded` di accordion riwayat dengan badge penjelas, serta penyajian riwayat audit pada view staf (Pesanan Buku & Seragam).

**Blocked by:** 03: Alur Intake Portal Publik & Dialog Konfirmasi Pesanan Gantung

**Status:** ready-for-agent

- [ ] Halaman status pesanan portal publik memprioritaskan pesanan aktif dan menampilkan pesanan `superseded` dengan status "Digantikan oleh #[NOMOR_BARU]".
- [ ] View staf menampilkan badge/filter `superseded` dengan link audit ke pesanan baru.
- [ ] Integration test E2E yang memverifikasi seluruh siklus: order gantung $\rightarrow$ revisi kurikulum $\rightarrow$ cek riwayat portal & staf.
