## 1. Design Tokens and Typography Foundation

- [x] 1.1 Update `tailwind.config.js` to define modern Facebook color palette tokens (`fb-blue`, `fb-bg`, `fb-card`, `fb-text`, `fb-muted`, `fb-border`, `fb-divider`) and remove Newsreader serif font. Verify build compiles with `bun run build`.
- [x] 1.2 Update `src/index.css` to enforce sans-serif typography across headings and body, setting smooth antialiasing and background defaults. Verify styles with `bun run type-check`.

## 2. App Shell & Navigation Overhaul

- [x] 2.1 Refactor `src/App.tsx` header and navigation tabs into the modern Facebook navbar style with white sticky header, active blue underline/pill indicator, and updated status chips. Verify with `bun run build`.
- [x] 2.2 Update `src/components/BranchSelector.tsx` to match Facebook pill dropdown styling (`rounded-full`, `#F0F2F5` background, hover `#E4E6EB`). Verify by interacting in local dev preview.

## 3. Login Screen Transformation

- [x] 3.1 Redesign `src/views/LoginView.tsx` into a modern Facebook-styled login layout with split branding and a crisp white authentication card with primary blue action buttons. Verify responsive layout and authentication flow.

## 4. Main Views Refactoring

- [x] 4.1 Update `src/views/InventoryView.tsx` to use Facebook white cards, pill search bar, modern filter buttons, and clean table borders. Verify all actions (search, filter, pagination, quick transfer) function properly.
- [x] 4.2 Update `src/views/CatalogView.tsx` to align cards, modals, cover previews, and form inputs with Facebook design tokens. Verify catalog add/edit works.
- [x] 4.3 Update `src/views/TransfersView.tsx` to adopt Facebook timeline/card styling for shipment manifests, dispatch badges, and status steppers. Verify transfer creation and status transitions.
- [x] 4.4 Update `src/views/SettingsView.tsx` to adopt Facebook settings list & card aesthetics for school management, users, and audit logs. Verify administrative actions work.

## 5. Verification & Quality Assurance

- [x] 5.1 Run full type safety verification `npm run type-check` and ensure zero errors.
- [x] 5.2 Run linting check `npm run lint` and resolve any formatting issues.
- [x] 5.3 Run production build `npm run build` and ensure bundle compiles cleanly.
- [x] 5.4 Run test suite `npm run test` and ensure all test scenarios pass.
