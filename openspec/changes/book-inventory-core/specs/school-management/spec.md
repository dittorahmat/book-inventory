## Purpose

Provides organizational hierarchy management for the main central school and child branches, enforcing data isolation for branch-level users.

## ADDED Requirements

### Requirement: School entity registration and hierarchy
The system SHALL support creating and distinguishing between main central school (HQ/warehouse) and child school branches.

#### Scenario: Registering branches
- **WHEN** an administrator creates a new school record specifying name, address, and type (main vs branch)
- **THEN** the school record is persisted and made available for inventory assignment and shipment destination

### Requirement: Branch administrative data isolation
The system SHALL isolate book inventory and shipment views according to the authenticated user's branch assignment.

#### Scenario: Branch administrator accesses inventory
- **WHEN** a user authenticated as an administrator of Branch A requests book inventory
- **THEN** the system only returns physical copies currently located at Branch A and prevents access to other branches' internal stock
