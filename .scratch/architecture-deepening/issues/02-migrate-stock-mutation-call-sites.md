# 02: Migrate Stock Mutation Call Sites & Retire Shallow Primitives

**What to build:**
Memigrasikan seluruh call site mutasi stok fisik (PO receipt, internal transfer/shipment dispatch & receive, assembly, unbundling, dan serah terima/handover) untuk menggunakan `moveInventoryStock`.

**Blocked by:** 01-deep-stock-movement-engine

**Status:** ready-for-agent

- [ ] Migrasikan `order-handover.ts`
- [ ] Migrasikan `package-assembly.ts`
- [ ] Migrasikan `purchase-order/receipt.ts`
- [ ] Migrasikan `shipment/write.ts`
- [ ] Pertahankan backward-compatibility alias di `src/server/services/stock/index.ts`
- [ ] Seluruh test eksisting tetap lulus
