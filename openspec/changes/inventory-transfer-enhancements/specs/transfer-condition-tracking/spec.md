## Purpose

Records transfer motivation via a custom reason attribute and displays physical book condition indicators throughout the inter-school shipment lifecycle.

## ADDED Requirements

### Requirement: Optional Transfer Reason Field
The transfer shipment entity and transfer creation interface SHALL support an optional free-text `reason` field to record why books are being moved between locations (e.g. return damaged copies, new distribution, branch rebalance).

#### Scenario: Creating shipment with a transfer reason
- **WHEN** a transfer shipment is created with a `reason` specified
- **THEN** the reason is stored in the database and visible in shipment lists and detail views.

### Requirement: Display Item Condition in Transfer Views
The transfer management interface and shipment item records SHALL prominently display each item's physical condition (`new`, `good`, `fair`, `damaged`) when creating, viewing, or receiving transfer shipments.

#### Scenario: Viewing transfer shipment items
- **WHEN** viewing items included in an in-progress or draft shipment
- **THEN** each item row clearly indicates the original condition of the physical copy alongside title and barcode.
