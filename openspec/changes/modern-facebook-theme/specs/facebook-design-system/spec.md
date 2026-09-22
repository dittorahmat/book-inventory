## Purpose

Provides a cohesive modern Facebook aesthetic across the entire Book Inventory and Logistics interface, utilizing Facebook Blue accents, clean white cards, cool canvas backgrounds, and consistent sans-serif typography.

## ADDED Requirements

### Requirement: Modern Facebook Color Palette and Tokens
The application SHALL apply Facebook modern visual theme colors across all layouts, backgrounds, texts, and borders.
Canvas background SHALL be `#F0F2F5`, card surfaces SHALL be `#FFFFFF`, primary action buttons and focus states SHALL use `#1877F2` (hover `#166FE5`), primary text SHALL be `#050505`, secondary text SHALL be `#65676B`, and hairline borders SHALL be `#E4E6EB` / `#CED0D4`.

#### Scenario: View page background and cards
- **WHEN** user loads any view in the application
- **THEN** the global background renders in `#F0F2F5` and content panels render inside `#FFFFFF` cards with `#E4E6EB` borders and soft shadows

#### Scenario: Interacting with primary action button
- **WHEN** user hovers over or clicks a primary button
- **THEN** the button displays in `#1877F2` with hover transition to `#166FE5` and white text

### Requirement: Sans-serif Clean Typography
The application SHALL use clean sans-serif typography (`Inter`, system sans-serif fonts) for all text, headings, badges, and metrics, eliminating previous serif display fonts.

#### Scenario: Displaying headers and titles
- **WHEN** any header, card title, or dialog heading is rendered
- **THEN** it renders with the sans-serif font family with crisp font weights and zero serif styling

### Requirement: Facebook Header and Navigation Bar
The application header SHALL render with a sticky `#FFFFFF` background, a subtle bottom border (`#E4E6EB`), a Facebook-styled brand title, and tab navigation with blue active indicators.

#### Scenario: Navigating between tabs
- **WHEN** user selects a navigation tab (Catalog, Inventory, Transfers, Settings)
- **THEN** the active tab displays highlighted with Facebook Blue text (`#1877F2`) and an active indicator, while inactive tabs display muted text (`#65676B`)

### Requirement: Facebook-styled Login Screen
The login screen SHALL display a modern Facebook-inspired layout featuring a branded hero section and a clean white credential card with high-contrast inputs and a full-width blue login button.

#### Scenario: Unauthenticated visitor visits application
- **WHEN** an unauthenticated session is detected
- **THEN** user is presented with a Facebook-style login card with bold blue submit button and clean input styling

### Requirement: Modern Component Surfaces across Views
All data tables, modal dialogs, search input pills, and action forms in Catalog, Inventory, Transfers, and Settings views SHALL adhere to the Facebook card-and-pill styling.

#### Scenario: Opening a creation or detail modal
- **WHEN** user triggers a modal dialog (e.g. Add Book, Transfer Items)
- **THEN** the modal renders with a pure white surface, rounded-xl corners, Facebook blue header/primary action buttons, and neutral pill close/cancel buttons
