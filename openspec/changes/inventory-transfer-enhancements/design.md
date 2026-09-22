## Context

See [proposal.md](file:///D:/development/book-inventory/openspec/changes/inventory-transfer-enhancements/proposal.md) for motivation and background.

Existing system uses Hono + Drizzle SQLite backend, and React + Vite frontend. `transfer_shipments` currently tracks `fromSchoolId`, `toSchoolId`, `status`, `dispatchedAt`, `receivedAt`, `notes`, but lacks a structured reason/category. Physical copies in `book_items` have a `condition` field, but during transfers, operators do not immediately see the items' condition on list/detail cards. In `InventoryView.tsx`, branch staff can view items but lack filtering by condition or initiating transfers directly.

## Goals / Non-Goals

**Goals:**
- Add `reason` column to `transfer_shipments` table with proper migration (`bun run db:push` and D1 migration scripts).
- Update backend API routes `/api/shipments` and `/api/shipments/:id` to include `reason` and join physical item `condition`.
- Add client-side search bar to `CatalogView.tsx` mirroring the smooth UX of `InventoryView.tsx`.
- Add condition filter (`all`, `new`, `good`, `fair`, `damaged`) and row multi-select checkboxes to `InventoryView.tsx`.
- Provide a Quick Transfer modal in `InventoryView.tsx` that allows selecting a target school (HQ or other branches), inputting an optional reason, and creating a draft shipment directly.
- Display `condition` badges in transfer item tables in `TransfersView.tsx`.

**Non-Goals:**
- Automated background courier tracking or third-party logistics integration.
- Restricting transfer destination solely to HQ (transfers remain multi-branch compatible).
- Complex batch barcodes scanner hardware protocol (standard manual/webcam scan and multi-select is retained).

## Decisions

1. **Database Column for Transfer Reason**:
   - *Choice*: Add optional nullable text column `reason` to `transfer_shipments`.
   - *Rationale*: A free-text string allows flexible reasons (e.g. "Retur buku rusak", "Rebalancing stok akhir semester") without locking into rigid enums that may need future migrations.
   - *Alternative Considered*: Enum column `type` (e.g. `['return', 'distribution', 'transfer']`). Rejected because user specifically preferred free-text optional description for operational flexibility.

2. **Bulk Selection & Quick Transfer UX**:
   - *Choice*: Row checkbox multi-select with a floating bottom/top banner showing "X items selected" and a "Transfer / Retur" trigger button opening a modal.
   - *Rationale*: Clean, intuitive pattern matching modern enterprise design guidelines without adding clutter to each table row.
   - *Alternative Considered*: Individual action button on each row. Rejected because returning damaged books is typically done in batches of multiple copies.

3. **Catalog Search Architecture**:
   - *Choice*: Client-side instant filter on the already loaded catalog list with debounce.
   - *Rationale*: Matches the existing UX pattern in `InventoryView.tsx`, zero extra API roundtrips for standard catalogs, and very snappy response.

## Risks / Trade-offs

- [Risk: Inconsistent item status during multi-select] → Mitigation: Quick Transfer validation ensures only items in `in_stock` status can be transferred. If an item is already `in_transit` or `lost`, it cannot be checked or submitted.
- [Risk: D1 vs Local SQLite migration drift] → Mitigation: Execute both `bun run db:push` (local) and generate D1 migration SQL script per AGENTS.md conventions.

## Migration Plan

1. Update `src/db/schema.ts` with `reason` on `transfer_shipments`.
2. Run `bun run db:push` for local database.
3. Run `bun run db:generate` to generate D1 migration.
4. Verify tests pass with `bun run test`.
