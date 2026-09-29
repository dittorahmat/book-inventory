## Context

See `proposal.md` for motivation. Current state (verified in repo): `book_packages.price` exists and feeds student billing; `books` and `book_items` carry no price; the only unit economics live transiently in `purchase_order_items.unitPrice` and are dropped on inbound receive (`procurement.ts`). `transfer_shipments` + `transfer_shipment_items(bookItemId NOT NULL)` support loose-only moves with no monetary fields; `shipments.ts` is 249 lines and `TransfersView.tsx` is 370 lines, so the 300-line gate (`scripts/check-file-size.ts`, `AGENTS.md`) forces new code into sub-files. All new IDs must validate with `z.string().min(1)`.

## Goals / Non-Goals

**Goals:**
- One master unit price per catalog title, manually editable, seeded for demo data, surfaced in stock UIs.
- One shipment draft carrying loose lines plus physical package lines (`package_item_ids` of ready bundles) with frozen per-line snapshots and a server-computed informative header total.
- Bundle stock stays monitored: dispatch locks bundles as `dispatched`, receive moves them to the destination school.

**Non-Goals:**
- No per-copy acquisition costing (`book_items.unitPrice`) and no branch-asset ledger/deduction in this change; header total is display-only (upgrade-ready, not accounting).
- No auto-assemble/reserve at destination; packages must be assembled (`Rakit Paket`) before they can be transferred.
- No package-price-vs-sum-of-parts reconciliation UI.

## Decisions

### D1: `books.price` (master) over `book_items.unitPrice` (per-copy)
- Rationale: 1 column, 1 form field, 1 seed backfill; matches "input manual saat create buku" and covers transfer snapshot needs. PO history stays as purchase evidence.
- Alternative rejected: per-copy cost — accurate but forces price entry into `batch-generate` (up to 200 copies), complicates backfill, and is unnecessary for an informative total.
- Upgrade path preserved: snapshots already freeze values, so a later `book_items.acquisition_cost` can be added without touching shipment history.

### D2: Extend `transfer_shipment_items` polymorphically (no second line table)
- Columns on `transfer_shipment_items`: `item_type TEXT('loose'|'package') NOT NULL DEFAULT 'loose'`, `book_item_id` nullable, `package_id TEXT NULL` (denormalized master reference for display), `package_item_id TEXT NULL` (physical bundle reference), `quantity INTEGER NOT NULL DEFAULT 1`, `unit_price_snapshot INTEGER NOT NULL DEFAULT 0`.
- Invariant: `loose` rows have `book_item_id SET AND package_item_id NULL AND quantity = 1`; `package` rows have `package_item_id SET AND book_item_id NULL AND quantity = 1`. Enforced in Zod + service guard (SQLite has no CHECK reliance for D1 portability).
- Header: `transfer_shipments.total_declared_value INTEGER NOT NULL DEFAULT 0`, always computed server-side as `SUM(unit_price_snapshot * quantity)`; client-sent totals ignored.
- Alternative rejected: separate `transfer_shipment_packages` table — cleaner normalization but doubles dispatch/receive/detail/join code for a v1 informative feature.
- Snapshot source: loose from `books.price` at draft time (via `bookItems.bookId`), package from `book_packages.price` at draft time (via `packageItems.packageId`); missing master reads as 0, never null.

### D3: Physical package lines move real stock
- Draft validation for packages mirrors loose guards: bundle must exist, belong to `fromSchoolId`, and be `in_stock` (reserved/delivered bundles are not transferable).
- Dispatch: loose `book_items` `in_stock -> in_transit`; bundles `in_stock -> dispatched` (previously unused enum value). Shipment `draft -> in_transit`.
- Receive per package receipt: `good` → `currentSchoolId = toSchoolId, status = in_stock`; `damaged` → same move + appended transit-damage note; `missing` → bundle row deleted (mirrors `lost` for loose). Any non-good receipt (either type) yields `completed_with_discrepancy`, else `completed`.
- Rationale: bundle stock stays monitored at both schools, consistent with loose semantics; packages must be assembled before transfer, so the system never records fictitious bundles.

### D4: API shape (additive, backward compatible)
- `POST /api/shipments` gains optional `packageItemIds: string[]` alongside existing `bookItemIds` (both optional, at least one non-empty); each package item is one row with `quantity = 1`. Response returns created shipment with `total_declared_value` + line snapshots.
- `GET /api/shipments` list items gain `total_declared_value`, `looseCount`, `packageCount` for the card total without extra fetch.
- `GET /api/shipments/:id` joins loose lines to `book_items+books` (as today) and package lines to `package_items+book_packages(code,name,price)`, each exposing `item_type, quantity, unit_price_snapshot, line_total`.
- `GET /api/books` and `GET /api/book-items` include `price` (book-items via join) so UIs need no extra round-trip. A new read endpoint `GET /api/package-items?schoolId=&status=in_stock` (or reuse packages stock endpoint) feeds the package barcode picker.
- `POST /api/books` and `PATCH /api/books/:id` accept `price: z.number().int().min(0).default(0)`.

### D5: UI decomposition for the 300-line gate
- New `src/components/transfers/` sub-components: `LoosePicker.tsx`, `PackagePicker.tsx`, `TransferTotalBar.tsx`; new `src/lib/transfer-pricing.ts` (`formatRupiah`, `lineTotal`, `headerTotal`) and `src/lib/book-price.ts` if shared formatting needed.
- `TransfersView.tsx` and `InventoryView.tsx` quick-transfer get a `Satuan | Paketan` tab set + live total bar; `CatalogView.tsx` gains a price input (label above input) + price column; `PackagesView.tsx` BOM cards show per-component unit price + existing package price.
- Anti-slop: neutral Zinc/Slate base, solid `#1877F2`/Emerald accents, `rounded-2xl` containers / `rounded-xl` inputs / `rounded-lg` buttons, `:active:scale-[0.98]`, no purple/blue glow, no card-in-card, CTA labels 1-3 words single line, full loading/empty/error states with `try/catch` + `else` + `data.message` extraction.

## Risks / Trade-offs

- [Risk] Legacy books/shipments default to 0 → header totals understate history → Mitigation: seed backfill + migration default 0 + UI hint "Rp 0 = belum diisi"; no retroactive repricing of old shipments.
- [Risk] Package must be assembled before transfer → Mitigation: picker shows educational empty state ("Rakit dulu di tab Paket"); documented, not blocked.
- [Risk] Package `missing` deletes the bundle row → Mitigation: mirrors loose `lost`; discrepancy status + shipment history preserve the audit trail.
- [Risk] Master price drift vs frozen snapshots confuses staff → Mitigation: detail shows "harga saat kirim" caption; new drafts always read current master.
- [Risk] Remote D1 missing new columns (`no such column`) → Mitigation: `AGENTS.md` sequence mandatory — `db:generate`, local `db:push`, `wrangler d1 execute --remote --file=./drizzle/XXXX.sql`, `PRAGMA table_info` verify on both, before commit/push.
- [Risk] `shipments.ts` / view files breach 300-line gate → Mitigation: business logic to `src/server/services/transfer-valuation.ts`, UI to sub-components; run `bun run check:file-size` before done.
- [Risk] `bun.lock` version drift breaks Cloudflare build (bun 1.2.15) → Mitigation: lockfile ops only via `npx -y bun@1.2.15 install`, verify `lockfileVersion` unchanged.

## Migration Plan

1. `bun run db:generate` for `books.price`, shipment header/line columns, then a second `db:generate` for `package_item_id`; review each SQL (fix virtual-column copy selects with explicit defaults).
2. Local apply + smoke create/list/detail (drizzle-kit push is broken in this env via better-sqlite3 — apply with `bun:sqlite` runner using the same generated SQL).
2. Local `bun run db:push` + smoke create/list/detail.
3. Backfill seed prices in `src/server/seed.ts` (idempotent upsert, no duplicates) + rerun seed locally.
4. Apply to remote: `bun x wrangler d1 execute book-inventory-db --remote --file=./drizzle/<migration>.sql`; verify with `PRAGMA table_info(books)` / `(transfer_shipments)` / `(transfer_shipment_items)` remote.
5. Deploy order: migrate DB → deploy Worker → smoke catalog/transfer UIs. Rollback: new columns are nullable-with-default/additive; old code ignores them, so rollback = redeploy previous Worker (data created in between keeps snapshots harmlessly).

## Open Questions

- Q: Exact rupiah seed per title (Cambridge vs Nasional vs Diniyyah bands)? Deferrable: tasks include a seed-price table for user sign-off; code uses whatever table is approved without changing specs/design/tasks.
- Q: Future v2 — package availability warning + branch asset ledger from frozen snapshots? Explicitly out of scope; schema already supports it.
