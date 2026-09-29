## Purpose

Memberikan harga satuan master per judul buku di katalog agar stok satuan punya nilai acuan yang bisa diinput manual, di-seed, ditampilkan di UI, dan dipakai sebagai snapshot saat transfer antar sekolah.

## ADDED Requirements

### Requirement: Book catalog has manual unit price
The system SHALL store an integer rupiah unit price (`price >= 0`, default 0) on every book catalog record and accept it on create plus update flows.

#### Scenario: Create book with manual price
- **WHEN** a central admin creates a book with ISBN, title, author, publisher, and `price: 95000`
- **THEN** the created record persists `price: 95000` and GET catalog returns it.

#### Scenario: Create book without price defaults to zero
- **WHEN** a central admin creates a book without sending `price`
- **THEN** the system stores `price: 0` and the UI shows Rp 0 until edited.

#### Scenario: Reject negative price
- **WHEN** a create or update request sends `price: -1000`
- **THEN** the system rejects with 400 and a clear validation message, and no record is written.

#### Scenario: Flexible identifier validation
- **WHEN** any book create/update payload carries string IDs (UUID v4 or custom seed slugs)
- **THEN** validation uses `z.string().min(1)` and never `z.string().uuid()`.

### Requirement: Demo seed backfills unit prices
The system SHALL seed unit prices for all existing demo catalog titles so no seeded book remains priceless after migration.

#### Scenario: Seeded Cambridge book has price
- **WHEN** the idempotent seed runs on a fresh or existing DB
- **THEN** `b-math-2` (Cambridge Primary Mathematics Learner's Book 2) has a positive price consistent with its PO history band (e.g. >= 50000) and reruns do not duplicate records.

#### Scenario: Seeded national book has price
- **WHEN** the idempotent seed runs
- **THEN** `b-bindo-1` (Bahasa Indonesia: Aku Bisa! Kelas 1) has a positive price lower than the Cambridge band and remains stable across reruns.

### Requirement: Unit price is visible in stock UIs
The system SHALL display the catalog unit price wherever loose stock is browsed so staff can see per-title value at a glance.

#### Scenario: Catalog shows price column
- **WHEN** a user opens the Book Catalog view
- **THEN** each row/card shows the formatted rupiah unit price (e.g. Rp 95.000) plus loading, empty, and inline-error states.

#### Scenario: Inventory and BOM show unit price
- **WHEN** a user opens Inventory (loose list) or expands a package BOM in PackagesView
- **THEN** each loose row and each BOM component shows its catalog unit price without nested card-in-card layout, with label above input and WCAG AA contrast.
