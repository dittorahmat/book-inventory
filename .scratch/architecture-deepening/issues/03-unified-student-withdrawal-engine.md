# 03: Unified Student Withdrawal & Cancellation Engine

**What to build:**
Mengonsolidasi alur pengunduran diri siswa (ADR-0019) dari 5 file dangkal (`student-withdrawal.ts`, `book-withdrawal.ts`, `uniform-withdrawal.ts`, `refund-slip.ts`, `finance-refund.ts`) ke dalam satu deep domain module `src/server/services/order-withdrawal/`.

**Blocked by:** 02-migrate-stock-mutation-call-sites

**Status:** ready-for-agent

- [ ] Modul `src/server/services/order-withdrawal/` dengan method `requestWithdrawal` dan `approveWithdrawal`
- [ ] Penanganan terpadu untuk buku maupun seragam
- [ ] Pelepasan alokasi fisik stok otomatis
- [ ] Penerbitan nomor slip resmi `RET-B-*` / `RET-U-*`
- [ ] Pembuatan antrean refund Finance
- [ ] Test terpadu mencakup buku dan seragam
