## Purpose

Ensures API endpoints and frontend actions operate reliably across local SQLite and Cloudflare Workers runtime environments with flexible ID acceptance and actionable error feedback.

## ADDED Requirements

### Requirement: Flexible Entity ID Acceptance in Logistics Endpoints
The system SHALL accept any non-empty string identifier for school IDs, book IDs, and book item IDs in shipment and inventory generation endpoints, accommodating both standard UUIDs and seeded human-readable keys.

#### Scenario: Submitting transfer shipment with custom seeded school and item IDs
- **WHEN** a client submits a transfer creation request with `fromSchoolId: "school-alw-1"`, `toSchoolId: "school-alw-2"`, and item ID `"item-alw1-1-001"`
- **THEN** the server validates the payload without throwing 400 UUID format validation errors and proceeds with shipment processing

#### Scenario: Generating physical copies for seeded book and school
- **WHEN** a client submits batch generation for `bookId: "book-camb-01"` and `schoolId: "school-alw-1"`
- **THEN** the server accepts the IDs, persists the requested number of physical copies, and returns HTTP 201 with generated items

### Requirement: Reliable Shipment Receipt Confirmation
The system SHALL accept confirmation of received items with condition assessment and update both shipment state and physical inventory status.

#### Scenario: Branch confirms receipt of incoming shipment
- **WHEN** a branch administrator clicks "Konfirmasi Penerimaan" for an in-transit transfer shipment
- **THEN** the server updates each shipment item condition, assigns the items to the destination school, sets the shipment status to completed, and returns HTTP 200 with clear feedback to the UI

### Requirement: Actionable Error Feedback in Frontend Catalog & Transfers
The frontend user interface SHALL display explicit error notifications when API mutation requests fail instead of failing silently or closing without status updates.

#### Scenario: Catalog copy generation failure feedback
- **WHEN** generating copies fails or returns an error status from the server
- **THEN** the UI displays an alert or toast notification with the specific error message and preserves the current modal state

#### Scenario: Book registration failure feedback
- **WHEN** registering a new book fails due to duplicate ISBN or validation constraint
- **THEN** the UI alerts the user with the detailed server error message explaining the failure
