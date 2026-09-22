## Purpose

Provides a responsive and touch-optimized mobile interface for inventory managers and branch staff accessing the application from mobile devices (including Android smartphones).

## ADDED Requirements

### Requirement: Mobile Bottom Navigation Bar
The application SHALL render a persistent bottom navigation bar when the viewport width is below standard tablet/desktop threshold (< 768px / `md` breakpoint), allowing one-handed switching between primary views.

#### Scenario: Switching views from mobile bottom navigation
- **WHEN** user taps the "Branch Inventory" or "Book Catalog" icon in the bottom navigation bar on a mobile device
- **THEN** the application switches to the selected view immediately and updates the active icon state

#### Scenario: Role-based navigation on mobile
- **WHEN** a user with role `central_admin` logs in on mobile
- **THEN** the bottom navigation bar includes the "Settings" action, whereas for a `branch_admin` user it only includes allowed views

### Requirement: Adaptive Card View for Stock Inventory
The application SHALL render physical book copy items as responsive stacked cards on viewport widths below `md`, replacing the horizontal multi-column table layout.

#### Scenario: Displaying copy card information on mobile
- **WHEN** user views branch stock inventory on a mobile device
- **THEN** each physical copy displays its barcode tag, book title, ISBN, physical condition badge, and current status in a vertically stacked card format

#### Scenario: Selecting items for transfer on mobile
- **WHEN** user taps the selection checkbox or selection area on an available copy card
- **THEN** the card toggles its selection state with clear visual feedback and updates the floating batch transfer action counter

### Requirement: Touch-Target Accessibility and Safe Areas
All interactive touch elements SHALL maintain a minimum tappable area of 44x44px and bottom-affixed toolbars SHALL observe device safe area insets on mobile browsers.

#### Scenario: Interacting with condition dropdown on touch screen
- **WHEN** user changes the physical condition of a copy on mobile
- **THEN** the touch target allows comfortable tapping without misclicks on adjacent elements

#### Scenario: Floating action bars above bottom navigation
- **WHEN** the quick transfer floating bar is visible on mobile
- **THEN** it floats above the bottom navigation bar without overlapping or obstructing navigation controls
