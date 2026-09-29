## Purpose

Memberikan ringkasan operasional buku per sekolah dalam satu layar — kesiapan stok, aliran pemenuhan pesanan, kesehatan pembayaran, dan hal yang butuh perhatian — dengan tampilan berbeda untuk admin pusat (perbandingan antar kampus) dan admin cabang (detail kampus sendiri).

## ADDED Requirements

### Requirement: Dashboard is the default landing view after staff login
The system SHALL render the Dashboard view as the initial view for authenticated staff users instead of the student orders view, while keeping all existing tabs reachable.

#### Scenario: Central admin logs in
- **WHEN** a user with role `central_admin` completes login
- **THEN** the Dashboard view is shown first with the cross-school comparison mode active

#### Scenario: Branch admin logs in
- **WHEN** a user with role `branch_admin` completes login
- **THEN** the Dashboard view is shown first scoped to the branch school assigned to that user

#### Scenario: Existing tabs remain reachable
- **WHEN** the Dashboard view is active
- **THEN** the user can navigate to every pre-existing tab (student orders, packages, procurement, returns, inventory, catalog, transfers, settings) with unchanged behavior

### Requirement: HQ comparison mode shows all schools side by side
The system SHALL present one comparable summary card per school (all schools in the database) when viewed by `central_admin`, ordered to surface the school needing attention first.

#### Scenario: Hero highlights the weakest coverage
- **WHEN** a central admin opens the Dashboard and schools have differing coverage ratios
- **THEN** the hero area names the school with the lowest coverage ratio and its percentage

#### Scenario: Per-school cards are comparable
- **WHEN** a central admin views the comparison
- **THEN** each school card shows the same set of headline figures (physical stock, ready packages, coverage ratio, unpaid amount, open attention count)

#### Scenario: Drill-down into one school
- **WHEN** a central admin selects one school from the comparison
- **THEN** the detail layout for that school is shown with the same content a branch admin of that school would see

### Requirement: Branch isolation is enforced on dashboard data
The system SHALL restrict `branch_admin` dashboard data to the school assigned to that user; the user MUST NOT be able to view another school's figures by any dashboard control or API parameter.

#### Scenario: Branch admin cannot see other schools
- **WHEN** a branch admin opens the Dashboard
- **THEN** only their assigned school's data is displayed and no school switcher for other schools is offered

#### Scenario: Cross-school API access is rejected
- **WHEN** a branch admin requests the summary endpoint with a different school's identifier
- **THEN** the system returns a forbidden error and no figures from the other school

### Requirement: Coverage ratio is the hero metric
The system SHALL compute coverage ratio as ready packages divided by waiting orders (`package_items` with status `in_stock` divided by `student_book_orders` with fulfillment `waiting_preparation`, scoped to the school) and display it as the single most prominent figure.

#### Scenario: Healthy coverage
- **WHEN** ready packages equal or exceed waiting orders
- **THEN** coverage is shown as 100% or above-equivalent capped display with a healthy status indicator

#### Scenario: Coverage shortfall
- **WHEN** ready packages are fewer than waiting orders
- **THEN** coverage is shown below 100% with an attention status indicator and the absolute shortfall count

#### Scenario: No waiting orders
- **WHEN** a school has zero waiting orders
- **THEN** coverage is shown as fully ready (no division-by-zero error) with a neutral/healthy indicator

### Requirement: Fulfillment funnel explains the flow behind coverage
The system SHALL display the order fulfillment funnel (`waiting_preparation` -> `ready_for_pickup` -> `picked_up`) with counts and percentages per stage, scoped to the school (or per school in comparison).

#### Scenario: Bottleneck is visible
- **WHEN** most orders sit in `waiting_preparation` while few are `ready_for_pickup`
- **THEN** the funnel visualization makes the waiting stage the largest segment so the bottleneck is immediately readable

### Requirement: Payment health is summarized in monetary terms
The system SHALL display the share of paid orders, the outstanding rupiah amount (`total_amount - paid_amount` summed over unpaid/partial orders), and the count of pending scholarship approvals.

#### Scenario: Outstanding amount is explicit
- **WHEN** a school has unpaid or partially paid orders
- **THEN** the dashboard shows the total outstanding rupiah figure and the count of affected orders

#### Scenario: Scholarship queue is surfaced
- **WHEN** orders with `scholarship_pending` status exist
- **THEN** their count is shown as a distinct KPI requiring approval action

### Requirement: Attention list aggregates items needing action
The system SHALL list counts for damaged/lost stock, reported (unhandled) returns, in-transit transfers, and unreceived purchase orders as a single "needs attention today" section.

#### Scenario: Empty attention state
- **WHEN** no attention items exist for the school
- **THEN** an explicit all-clear empty state is shown (never a blank section)

#### Scenario: Attention item navigates to its workflow
- **WHEN** the user activates an attention entry (e.g. reported returns)
- **THEN** the user is taken to the corresponding existing workflow view filtered to the relevant school

### Requirement: Breakdown by grade level and curriculum
The system SHALL break down students, waiting orders, and ready stock by `grade_level` and `curriculum_type` so staff can see which class tier drives demand.

#### Scenario: Grade tier with shortfall is identifiable
- **WHEN** one grade/curriculum tier has waiting orders exceeding ready stock
- **THEN** that tier is flagged in the breakdown

### Requirement: Single aggregated summary endpoint
The system SHALL expose one read-only endpoint that returns the full dashboard payload for the requested scope in a single response, accepting both seeded string identifiers and UUIDs as school identifiers.

#### Scenario: One round-trip per view
- **WHEN** the Dashboard view loads for a given scope
- **THEN** all figures are fulfilled by a single endpoint call (no per-metric fan-out from the frontend)

#### Scenario: Flexible school identifier
- **WHEN** the endpoint is called with a seeded string id (e.g. `school-alw-1`) or a UUID v4
- **THEN** both forms are accepted and resolve to the same school

#### Scenario: Endpoint failure is visible to the user
- **WHEN** the summary endpoint returns an error or an unsuccessful payload
- **THEN** the Dashboard shows an explicit error message with retry action (never a silent empty screen)
