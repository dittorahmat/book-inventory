## Purpose

Tracks physical book copies (items) with individual asset tags or barcodes, physical condition grading, and current school branch allocation.

## ADDED Requirements

### Requirement: Physical book item registration
The system SHALL register individual physical copies linked to a book catalog entry, each having a unique barcode or asset tag.

#### Scenario: Bulk creating copies with asset tags
- **WHEN** an admin generates 20 physical copies of a book for the central school
- **THEN** 20 unique `book_items` records are created with status `in_stock`, condition `new`, assigned to the central school

### Requirement: Condition and status tracking
The system SHALL track physical condition (`new`, `good`, `fair`, `damaged`) and operational status (`in_stock`, `in_transit`, `disposed`, `lost`) for every copy.

#### Scenario: Updating copy condition on audit
- **WHEN** a school admin inspects a copy and marks its condition as `damaged`
- **THEN** the book item's condition is updated and an audit log timestamp is recorded
