# 01: Deep Stock Movement Engine

**What to build:**
Membangun modul inti yang mendalam `src/server/services/stock/movement.ts` (`moveInventoryStock`) yang mengenkapsulasi mutasi saldo (`book_stocks`, `package_stocks`), validasi ketersediaan/stok minimum, pencatatan otomatis audit ke `stock_adjustments`, dan pengarsipan shadow barcode secara atomik di dalam satu batch transaksi.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Memiliki interface tunggal `moveInventoryStock(database, movement, deps)`
- [ ] Validasi saldo cukup saat mutasi negatif (debit)
- [ ] Pencatatan otomatis ke `stock_adjustments` dengan referensi dokumen dan alasan yang tepat
- [ ] Dukungan pergerakan antar-lokasi (transfer: debit di asal, credit di tujuan)
- [ ] Unit test komprehensif di `src/server/services/stock/movement.test.ts`
