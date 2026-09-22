## Context

The existing frontend uses Tailwind CSS v3 with custom color tokens (`paper`, `surface`, `ink`, `muted`, `accent`) and serif font configurations defined in `tailwind.config.js` and `src/index.css`. The application has five primary views (`LoginView`, `CatalogView`, `InventoryView`, `TransfersView`, `SettingsView`) plus a global shell in `App.tsx` and modular components in `src/components/`.

## Goals / Non-Goals

**Goals:**
- Centralize modern Facebook design tokens in `tailwind.config.js` (`fb-blue`, `fb-bg`, `fb-card`, `fb-text`, `fb-muted`, `fb-border`, `fb-hover`, etc.).
- Update `src/index.css` to enforce pure modern sans-serif typography across all elements (`Inter`, `system-ui`, `sans-serif`).
- Redesign `App.tsx` navigation header to Facebook's clean white desktop/mobile navbar with sticky positioning, centered/left tabs, active blue underline/pill, and rounded avatar controls.
- Transform `LoginView.tsx` into a modern Facebook login experience.
- Refactor all sub-views (`CatalogView`, `InventoryView`, `TransfersView`, `SettingsView`) and components to use the Facebook color palette, rounded pill buttons, white card containers, and soft shadow styling.
- Maintain 100% functionality and test suite passing (`npm run test`, `npm run type-check`, `npm run build`).

**Non-Goals:**
- Creating a dynamic dark mode or custom runtime theme switcher (user specified a complete, permanent theme migration).
- Modifying backend endpoints, Drizzle schema, or D1 migrations.

## Decisions

### 1. Tailwind Token Mapping
We will expand and update `tailwind.config.js` with semantic Facebook tokens while maintaining backwards compatibility for existing utility names where feasible:
- `fb-blue`: `#1877F2`
- `fb-blue-hover`: `#166FE5`
- `fb-blue-light`: `#E7F3FF`
- `fb-bg`: `#F0F2F5`
- `fb-card`: `#FFFFFF`
- `fb-text`: `#050505`
- `fb-muted`: `#65676B`
- `fb-border`: `#E4E6EB`
- `fb-border-hover`: `#CED0D4`
- `fb-divider`: `#E4E6EB`
- `fb-button-secondary`: `#E4E6EB`
- `fb-button-secondary-hover`: `#D8DADF`

*Rationale*: Rather than doing ad-hoc hex replacements in dozens of files, tokens ensure consistent brand fidelity and easy adjustment.

### 2. Typography Normalization
Remove `Newsreader` from fonts in `tailwind.config.js` and eliminate `@layer base { h1, h2, h3 { font-family: 'Newsreader' } }` in `src/index.css`. Use `Inter`, `-apple-system`, `BlinkMacSystemFont`, `system-ui`, `sans-serif`.

*Rationale*: Facebook's signature look relies heavily on clean, legibly weighted sans-serif typography.

### 3. Header & Navigation Structure
- Header container: `bg-white border-b border-[#E4E6EB] shadow-xs sticky top-0 z-40`.
- Active tab indicator: Blue text `#1877F2` with bottom border `border-b-2 border-[#1877F2]` or rounded pill highlight `bg-[#E7F3FF] text-[#1877F2]`.
- Branch selector: Facebook pill dropdown (`bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-full px-3 py-1.5 text-xs font-semibold`).

### 4. Cards and Modals
- Cards: `bg-white rounded-xl border border-[#E4E6EB] shadow-sm`.
- Modals: `bg-white rounded-2xl border border-[#CED0D4] shadow-xl`.
- Action buttons: Primary `bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-lg shadow-sm`. Secondary `bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] font-semibold rounded-lg`.

## Risks / Trade-offs

- **[Risk] High volume of utility classes in existing views**:
  - *Mitigation*: Systematically update each view file one by one, verifying with `npm run type-check` and visual checks after each view.
- **[Risk] Contrast readability on inputs**:
  - *Mitigation*: Ensure text on `#F0F2F5` inputs uses `#050505` with high contrast borders when focused (`focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]`).
