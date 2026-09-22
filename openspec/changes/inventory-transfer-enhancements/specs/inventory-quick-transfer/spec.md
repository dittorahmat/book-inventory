## Purpose

Enables branch staff to quickly filter inventory items by physical condition and initiate transfer shipments directly using multi-select actions.

## ADDED Requirements

### Requirement: Filter Inventory by Physical Condition
The branch inventory interface SHALL allow filtering items by condition status (`new`, `good`, `fair`, `damaged`).

#### Scenario: User filters items by damaged condition
- **WHEN** the user selects the "Damaged" condition filter
- **THEN** only items with `condition = 'damaged'` are displayed in the inventory table.

### Requirement: Multi-Select Item Selection
The branch inventory interface SHALL allow users to select multiple book items using checkboxes and view the total number of selected items.

#### Scenario: User selects multiple items
- **WHEN** the user checks checkboxes on specific item rows or uses the "Select All" checkbox
- **THEN** the selection count is updated and a bulk action toolbar appears.

### Requirement: Quick Transfer Creation from Inventory
The system SHALL provide a modal action from the bulk action toolbar to create a draft transfer shipment containing the selected items with customizable destination school and optional transfer reason.

#### Scenario: User creates a transfer from selected inventory items
- **WHEN** the user selects one or more items, clicks "Create Transfer / Return", selects a destination school, enters an optional reason, and submits the form
- **THEN** a new draft transfer shipment is created with all selected items attached, and the user receives confirmation with a link or redirection to the transfer record.
