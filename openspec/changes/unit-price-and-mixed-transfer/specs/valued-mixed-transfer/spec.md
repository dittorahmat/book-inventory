## Purpose

Memungkinkan satu surat jalan transfer antar sekolah membawa baris satuan dan baris paketan fisik sekaligus, lengkap dengan snapshot harga per baris dan total nominal informatif yang stabil terhadap perubahan harga master, sambil tetap memonitor stok bundel di kedua sekolah.

## ADDED Requirements

### Requirement: Mixed shipment lines (loose plus physical packages)
The system SHALL accept a shipment draft containing zero or more loose lines (`bookItemIds`) and zero or more physical package lines (`packageItemIds` referencing ready `package_items` barcodes), requiring at least one line of either kind.

#### Scenario: Create mixed draft
- **WHEN** HQ creates a shipment to a branch with 3 loose barcodes and 2 ready-bundle barcodes
- **THEN** the system creates one `draft` shipment containing 3 loose rows and 2 package rows, and rejects when both lists are empty.

#### Scenario: Reject unknown package
- **WHEN** a draft references a `package_item_id` that does not exist
- **THEN** the system rejects with 400 identifying the bad package and creates nothing.

#### Scenario: Only ready bundles are transferable
- **WHEN** a referenced bundle is not `in_stock` (reserved, dispatched, delivered) or belongs to another school
- **THEN** the system rejects with 400 naming the offending barcode, mirroring the loose-stock guard.

#### Scenario: Loose lines keep existing guards
- **WHEN** a loose barcode does not exist, belongs to another school, or is not `in_stock`
- **THEN** the system rejects with 400 naming the offending barcode, unchanged from current behavior.

#### Scenario: Flexible identifier validation
- **WHEN** shipment payloads carry school, book-item, or package IDs as UUID v4 or custom slugs (e.g. `school-alw-1`)
- **THEN** validation uses `z.string().min(1)` and never `z.string().uuid()`.

### Requirement: Price snapshots and informative total
The system SHALL snapshot the unit price of every line at draft creation from the current master (`books.price` for loose, `book_packages.price` for packages), compute `total_declared_value` as the sum of snapshots, freeze those values for the life of the shipment, and expose them as informative display fields.

#### Scenario: Total equals sum of snapshots
- **WHEN** a draft has 2 loose lines at Rp 100.000 each and 2 package lines at Rp 1.850.000 each
- **THEN** the header shows `total_declared_value: 3900000` and each line exposes its snapshot.

#### Scenario: Master price change does not rewrite history
- **WHEN** `books.price` or `book_packages.price` changes after a shipment is created
- **THEN** existing shipment lines and header total remain at their snapshot values while new drafts use the new master.

#### Scenario: Detail and list expose nominal
- **WHEN** a user opens the shipment list or detail
- **THEN** the response includes per-line `item_type`, `quantity`, `unit_price_snapshot`, `line_total`, and header `total_declared_value` plus currency-safe integer handling.

### Requirement: Physical stock moves on dispatch and receive
The system SHALL move both loose `book_items` and physical `package_items` through dispatch/receive so bundle stock stays monitored at origin and destination, keeping the existing `draft -> in_transit -> completed / completed_with_discrepancy` lifecycle.

#### Scenario: Dispatch locks both stock types
- **WHEN** a mixed draft is dispatched
- **THEN** listed loose items become `in_transit` and listed bundles become `dispatched`, and shipment status becomes `in_transit`.

#### Scenario: Receive completes with per-type discrepancy
- **WHEN** a mixed `in_transit` shipment is received with all loose lines `good` and all package lines `good`
- **THEN** loose items move to the destination school as `in_stock`, bundles move to the destination school as `in_stock`, and status becomes `completed`.
- **WHEN** any loose receipt is `missing`/`damaged`, or any package receipt is `missing`/`damaged`
- **THEN** status becomes `completed_with_discrepancy`, loose `missing` becomes `lost`, loose `damaged` becomes `in_stock` + `damaged` at destination, package `damaged` becomes `in_stock` at destination with a transit-damage note, and package `missing` deletes the bundle row.

#### Scenario: Frontend shows live total and explicit errors
- **WHEN** staff build a mixed draft in TransfersView or quick-transfer with fetch failures or 400 responses
- **THEN** the UI shows a live total (sum of selected loose + package lines), loading/skeleton and educational empty states, and explicit alert/toast extracting `data.message`, never failing silently.
