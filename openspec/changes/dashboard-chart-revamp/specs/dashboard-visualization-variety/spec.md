## Purpose

Provides varied, actionable, and modern dashboard visualizations (Stepped Pipeline, Radial Gauge Meter, and Treemap) to enhance inventory tracking clarity.

## ADDED Requirements

### Requirement: Stepped fulfillment pipeline visualization
The dashboard SHALL display the order fulfillment flow as a stepped pipeline process (waiting, ready, picked) showing order counts and proportional progression rather than standalone vertical bars.

#### Scenario: Displaying fulfillment stages with non-zero orders
- **WHEN** the active school has orders distributed across waiting, ready, and picked stages
- **THEN** the pipeline SHALL render connected stage cards indicating the order count, stage status, and transition flow.

#### Scenario: Displaying fulfillment stages when orders are empty
- **WHEN** total orders across waiting, ready, and picked are zero
- **THEN** the component SHALL display a friendly empty state message stating no orders exist for the current period.

### Requirement: Radial gauge package coverage indicator
The dashboard SHALL visualize school package coverage ratio using a radial gauge progress meter with distinct color thresholds for critical, warning, and safe levels.

#### Scenario: Low package coverage below seventy percent
- **WHEN** the school coverage ratio is less than 0.70 (70%)
- **THEN** the gauge SHALL display the needle or arc in the critical red tone with shortfall count.

#### Scenario: Adequate package coverage ninety percent or higher
- **WHEN** the school coverage ratio is 0.90 (90%) or higher, or null (no waiting orders)
- **THEN** the gauge SHALL display the arc in the safe emerald tone indicating ready state.

### Requirement: Treemap visualization of stock by book title
The dashboard SHALL display a Treemap showing the proportion of available stock across top book titles in the school inventory.

#### Scenario: Stock items available by book title
- **WHEN** the school has loose stock registered across multiple book titles
- **THEN** the Treemap SHALL render proportional bounding tiles labeled with book title and quantity, with interactive tooltips on hover.

#### Scenario: No stock items recorded
- **WHEN** the school has zero physical book stock recorded
- **THEN** the Treemap SHALL render an informative empty state card without crashing or throwing errors.
