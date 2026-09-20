## Purpose

Manages the inter-school stock transfer workflow between central HQ and school branches, including shipment dispatch, in-transit status, and receipt verification.

## ADDED Requirements

### Requirement: Transfer shipment creation and item packing
The system SHALL allow central school managers to draft transfer shipments and associate specific physical book copies (`book_items`) by scanning their barcodes.

#### Scenario: Adding items to a shipment
- **WHEN** central admin selects destination Branch B and scans 10 available copies from central stock
- **THEN** a shipment record is created in `draft` status containing the 10 linked book items

### Requirement: Shipment dispatching
The system SHALL transition shipments to `in_transit` upon dispatch, automatically locking the contained book items as `in_transit`.

#### Scenario: Dispatching shipment
- **WHEN** central admin confirms dispatch of the shipment
- **THEN** the shipment status changes to `in_transit`, dispatched timestamp is recorded, and all linked book items have their status updated to `in_transit`

### Requirement: Shipment receipt and inventory transfer
The system SHALL allow the destination branch to receive shipments, verifying item counts and transferring physical ownership to the receiving branch.

#### Scenario: Receiving shipment successfully
- **WHEN** branch admin confirms receipt of the shipment and verifies all scanned barcodes
- **THEN** the shipment status changes to `completed`, received timestamp is recorded, and all linked book items have their `current_school_id` updated to the receiving branch with status `in_stock`

#### Scenario: Discrepancy reporting on receipt
- **WHEN** branch admin receives a shipment where 1 item is missing or damaged
- **THEN** the shipment is marked as `completed_with_discrepancy`, undamaged items are set to `in_stock` at the branch, and the missing item is flagged as `lost`
