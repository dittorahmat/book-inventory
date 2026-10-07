## Purpose

Provides varied, actionable, and modern dashboard visualizations (Stepped Pipeline, Radial Gauge Meter, Treemap, Horizontal Ranked Bars, and Scatter Matrix) across school-level and central-admin dashboard views.

## ADDED Requirements

### Requirement: Central admin branch health scatter plot
The central admin dashboard SHALL render a scatter/bubble plot mapping school branches across inventory coverage (X-axis) and payment realization (Y-axis) to identify performance quadrants.

#### Scenario: Displaying branch health scatter plot with multiple schools
- **WHEN** central admin views the comparison dashboard with multiple schools
- **THEN** each school SHALL be rendered as an interactive node positioned by package coverage percentage (X-axis: 0-100%) and paid share percentage (Y-axis: 0-100%), with hover tooltips displaying school name and order volume.

#### Scenario: Central admin branch health scatter plot with empty data
- **WHEN** no school summaries are available in the comparison payload
- **THEN** the component SHALL display a polite empty state message without rendering broken axes.

### Requirement: Central admin horizontal performance ranking bars
The central admin dashboard SHALL visualize school package coverage ratios as horizontal ranked bars ordered from lowest to highest coverage.

#### Scenario: Displaying ranked schools
- **WHEN** school summaries are present
- **THEN** schools SHALL be displayed with school name on the Y-axis and coverage bar extending horizontally with threshold tones (red <70%, yellow 70-89%, emerald >=90%).

### Requirement: Stepped fulfillment pipeline visualization
The dashboard (both school detail and aggregate comparison) SHALL display the order fulfillment flow as a stepped pipeline process (waiting, ready, picked) showing order counts and proportional progression rather than standalone vertical bars.

#### Scenario: Displaying fulfillment stages with non-zero orders
- **WHEN** the active view has orders distributed across waiting, ready, and picked stages
- **THEN** the pipeline SHALL render connected stage cards indicating the order count, stage status, and transition flow.

### Requirement: Radial gauge package coverage indicator
The dashboard SHALL visualize school package coverage ratio using a radial gauge progress meter with distinct color thresholds for critical, warning, and safe levels.

#### Scenario: Adequate package coverage ninety percent or higher
- **WHEN** the school coverage ratio is 0.90 (90%) or higher, or null (no waiting orders)
- **THEN** the gauge SHALL display the arc in the safe emerald tone indicating ready state.

### Requirement: Treemap visualization of stock by book title
The dashboard SHALL display a Treemap showing the proportion of available stock across top book titles in the school inventory.

#### Scenario: Stock items available by book title
- **WHEN** the school has loose stock registered across multiple book titles
- **THEN** the Treemap SHALL render proportional bounding tiles labeled with book title and quantity, with interactive tooltips on hover.
