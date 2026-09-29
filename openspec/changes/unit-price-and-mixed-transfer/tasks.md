## 1. Schema & Migration

- [x] 1.1 Add `books.price`, `transfer_shipments.total_declared_value`, and polymorphic shipment-line columns (`item_type`, nullable `book_item_id`/`package_id`, `quantity`, `unit_price_snapshot`) in `src/db/schema.ts` and verify `bun run db:generate` produces exactly one new `drizzle/*.sql` migration.
- [x] 1.2 Apply migration locally via `bun run db:push` and verify `PRAGMA table_info(books)` / `(transfer_shipments)` / `(transfer_shipment_items)` show the new columns.
- [x] 1.3 Apply the same migration file to remote D1 via `bun x wrangler d1 execute book-inventory-db --remote --file=./drizzle/<new-migration>.sql` and verify remote `PRAGMA table_info` matches local before any commit.

## 2. Book Unit Price Backend + Seed

- [x] 2.1 Extend `booksRouter` create/update validation with `price: z.number().int().min(0).default(0)` (keeping `z.string().min(1)` for IDs), expose `price` in GET responses, and verify `books.test.ts` create-default-0 / reject-negative scenarios pass.
- [x] 2.2 Backfill `src/server/seed.ts` idempotent prices below and verify reruns neither duplicate books nor reset edited prices; user to confirm table before apply:
  - `b-math-1` 120000, `b-sci-1` 115000, `b-eng-1` 130000
  - `b-pai-1` 55000, `b-bindo-1` 60000, `b-ppkn-1` 50000, `b-arab-1` 65000, `b-tahfidz-1` 75000
  - `b-math-2` 95000, `b-sci-2` 90000, `b-eng-2` 110000, `b-pai-2` 55000
- [x] 2.3 Include catalog `price` in `GET /api/book-items` (join) and verify Inventory/BOM reads get prices with no extra round-trip via route-level test.

## 3. Valued Mixed Transfer Backend

- [x] 3.1 Create `src/server/services/transfer-valuation.ts` (snapshot + header-total helpers, Zod guards for the loose/package invariant) and verify unit-tested totals equal `SUM(snapshot * qty)` and client totals are ignored.
- [x] 3.2 Extend `POST /api/shipments` with optional `packageItemIds` (ready-bundle barcodes, `in_stock` + own-school guard), snapshot loose from `books.price` and packages from `book_packages.price`, compute `total_declared_value` server-side, and verify mixed-draft / empty-reject / unknown-package / not-ready-bundle / bad-barcode scenarios in `shipments.test.ts` with both custom string IDs and UUIDs.
- [x] 3.3 Extend `GET /api/shipments` (add `total_declared_value`, `looseCount`, `packageCount`), `GET /api/shipments/:id` (join package lines to `package_items` + `book_packages`, expose `item_type/quantity/unit_price_snapshot/line_total`), add `GET /api/packages/items` ready-bundle list for pickers, and verify frozen-history scenario: master price change does not alter existing shipment totals.
- [x] 3.4 Dispatch locks loose (`in_transit`) and bundles (`dispatched`); receive moves both to destination (`in_stock`, package `damaged` + note, package `missing` deletes row) and verify mixed dispatch/receive tests pass (`in_transit`, `completed` vs `completed_with_discrepancy`).

## 4. Frontend (Anti-Slop, File-Size Gate)

- [x] 4.1 Add `CatalogView` price input (label above input) + price column/cards and `InventoryView` + `PackagesView` BOM unit-price display, and verify manual price entry, Rp formatting, loading/empty/inline-error states with `try/catch` + `data.message` alerts.
- [x] 4.2 Build `src/components/transfers/` (`LoosePicker.tsx`, `PackagePicker.tsx` as ready-bundle barcode checklist grouped by package, `TransferTotalBar.tsx`) plus `src/lib/transfer-pricing.ts`, wire `Satuan | Paketan` tabs + live total into `TransfersView` and quick-transfer, and verify mixed selection total, validation blocks, and no silent failures.
- [x] 4.3b Add migration `package_item_id` (db:generate 0006), apply locally + remote D1 with PRAGMA verify.
- [x] 4.4 Add direct package transfer from PackagesView tab (`PackageTransferModal.tsx`: pick ready-bundle barcodes + destination + live total, POST `packageItemIds`), reusing transfer components, and verify draft creation with nominal + no silent failures.
- [x] 4.3 Run `bun run check:file-size` and verify no non-grandfathered `src/**` file exceeds 400 lines (new feature code lives in new files, views only wire sub-components).

## 5. Quality Gates & Regression

- [x] 5.1 Run `npm run type-check` and verify zero `tsc --noEmit` errors.
- [x] 5.2 Run `npm run lint` and verify no remaining lint issues.
- [x] 5.3 Run `npm run build` and verify Vite + Worker bundles compile cleanly.
- [x] 5.4 Run `npm run test` and verify full suite passes including new book-price and mixed-transfer regression scenarios; report any pre-existing failures as unrelated notes.
