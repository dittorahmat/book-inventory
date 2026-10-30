# 05: Finance: Antrean & Eksekusi Refund Berdasarkan Slip Pengembalian Barang

**What to build:**
Antrean di tab Finance untuk memproses refund yang sudah disetujui gudang dari Slip Bukti Pengembalian Barang (`RET-B-*` & `RET-U-*`). Finance mencatat bukti transfer pengembalian dana via modul kanonik `payment-ledger` hingga status tiket retur menjadi `refunded`.

**Blocked by:**
02-book-withdrawal-cancellation, 03-uniform-withdrawal-cancellation

**Status:** ready-for-agent

- [ ] Query antrean siap-refund (`approved_ready_for_refund`) di endpoint finance
- [ ] Mutasi eksekusi refund terhubung ke `payment-ledger`
- [ ] Pelaporan slip & update status menjadi `refunded`
- [ ] UI antrean refund di tab Finance
- [ ] Regression & contract tests hijau
