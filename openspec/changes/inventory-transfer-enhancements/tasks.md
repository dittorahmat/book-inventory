## 1. Database Schema & Migration

- [x] 1.1 Add `reason` column to `transfer_shipments` table in `src/db/schema.ts` and verify with `bun run type-check`.
- [x] 1.2 Synchronize local SQLite database (`bun run db:push`) and generate D1 migration SQL (`bun run db:generate`).

## 2. Backend API Updates & Tests

- [x] 2.1 Update shipments route (`src/routes/shipments.ts`) to accept and return `reason`, and include item physical `condition` in transfer item queries.
- [x] 2.2 Add unit and integration tests verifying transfer creation with `reason` and item condition queries in test suite (`npm run test`).

## 3. Frontend Enhancements

- [x] 3.1 Implement instant search bar in `src/views/CatalogView.tsx` matching title, ISBN, author, and publisher.
- [x] 3.2 Add condition filter pill/dropdown (`all`, `new`, `good`, `fair`, `damaged`) and multi-select checkboxes to `src/views/InventoryView.tsx`.
- [x] 3.3 Add Quick Transfer modal with destination school selection and optional reason input to `src/views/InventoryView.tsx`.
- [x] 3.4 Update `src/views/TransfersView.tsx` to display transfer `reason` and physical copy `condition` badges in transfer lists and detail views.

## 4. Verification & Quality Checks

- [x] 4.1 Run full quality suite (`npm run type-check`, `npm run lint`, `npm run build`, and `npm run test`) and verify zero errors.
