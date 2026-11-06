# 04: Deep Order Operations & State Transition Engine

**What to build:**
Memperdalam `order-operations.ts` dari sekadar wrapper guard otorisasi 42-baris menjadi modul transisi status pesanan (`transitionOrder`).

**Blocked by:** 02-migrate-stock-mutation-call-sites

**Status:** ready-for-agent

- [ ] Fungsi `transitionOrder(database, orderId, intent, actor, deps)`
- [ ] Menyatukan diskresi finance, handover, supersede, dan pembatalan
- [ ] Pengurangan pemanggilan langsung `studentBookOrders` update di handler rute
- [ ] Test terpadu transisi status di `order-operations.test.ts`
