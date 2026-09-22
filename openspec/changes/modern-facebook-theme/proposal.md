## Why

The current user interface employs an editorial/warm paper monochrome aesthetic (`#FBFBFA` background, Newsreader serif typography, low-contrast subtle borders). While elegant for editorial reading, users requested an interface that feels like **modern Facebook** (clean white surfaces, signature blue `#1877F2`, cool gray canvas `#F0F2F5`, crisp sans-serif typography, soft rounded cards, and familiar interaction states).

Transitioning to this modern Facebook design system will improve visual familiarity, readability for school branch and warehouse operators, and clarity in inventory actions.

## What Changes

- **Design Tokens & Theme Foundation**:
  - Replace warm paper tones with Facebook's official color palette:
    - Primary Blue: `#1877F2` (hover `#166FE5`, active `#0E5ECE`, light soft `#E7F3FF`)
    - Background Canvas: `#F0F2F5`
    - Card & Modal Surface: `#FFFFFF`
    - Text Primary: `#050505`, Secondary/Muted: `#65676B`
    - Borders & Dividers: `#CED0D4` / `#E4E6EB`
    - Status Accents: Success Green `#31A24C`, Badge Red `#FA383E`
  - Remove Newsreader serif font; adopt pure modern Sans-serif typography (`Inter`, `system-ui`, `-apple-system`, `sans-serif`) across all headers and components.
- **Top Navigation Bar (App Header)**:
  - White sticky header (`bg-white border-b border-[#E4E6EB] shadow-sm`).
  - Facebook-style search/filter pills, rounded tabs with active blue indicator (`text-[#1877F2] border-b-2 border-[#1877F2]`), and clean rounded user/branch controls.
- **Card, Table & Component Styling**:
  - High-contrast pure white cards with smooth rounded corners (`rounded-xl`), crisp hairline borders (`border-[#E4E6EB]`), and soft shadows (`shadow-sm`).
  - Primary buttons styled in Facebook Blue (`bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-lg`).
  - Secondary/action buttons styled with Facebook neutral pill surfaces (`bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505]`).
- **Views Overhaul**:
  - **LoginView**: Facebook-inspired split layout (branded left section, clean white card login box on the right).
  - **CatalogView, InventoryView, TransfersView, SettingsView**: Update modals, search bars, badges, tables, and forms to conform to the Facebook theme.

## Capabilities

### New Capabilities
- `facebook-design-system`: End-to-end design system transformation introducing Facebook modern color tokens, sans-serif typography, rounded card layouts, and button/badge component patterns across all views.

### Modified Capabilities
<!-- No requirement changes to core business logic or APIs -->

## Impact

- `tailwind.config.js`: Updated color palette and font family definitions.
- `src/index.css`: Reset base styles and typography to modern sans.
- `src/App.tsx`: Header, navigation bar, and shell styling rewritten to modern Facebook desktop/mobile pattern.
- `src/views/*`: All views updated to consume new design tokens and classes.
- No database schema or backend API changes required.
