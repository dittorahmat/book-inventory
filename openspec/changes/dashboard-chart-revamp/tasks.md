## 1. Fulfillment Pipeline & Coverage Gauge

- [x] 1.1 Revamp `src/components/dashboard/FunnelChart.tsx` to display stepped pipeline cards with connecting chevron arrows and proportional progress, verifying zero typescript errors.
- [x] 1.2 Implement `src/components/dashboard/CoverageGauge.tsx` using Recharts semi-circle arc and threshold coloring (<70% red, 70-89% yellow, >=90% emerald), verifying it handles both null and non-null ratios.

## 2. Stock Treemap & Payment Meter

- [x] 2.1 Implement `src/components/dashboard/StockTreemap.tsx` using Recharts `<Treemap>` with custom tile renderer for book titles, truncated labels, and hover tooltips.
- [x] 2.2 Refactor `src/components/dashboard/PaymentsDonut.tsx` (or add `PaymentsMeter.tsx`) to provide a compact radial/linear progress meter for paid share and outstanding metrics.

## 3. Integration & Layout Alignment

- [x] 3.1 Update `src/views/DashboardView.tsx` to integrate `CoverageGauge`, revamped `FunnelChart`, and `StockTreemap` into the dashboard grid layout.
- [x] 3.2 Ensure all modified and new files respect the file-size limit (<400 lines) by running `bun run check:file-size`.

## 4. Verification & Quality Suite

- [x] 4.1 Verify TypeScript type checking with zero errors via `bun run type-check`.
- [x] 4.2 Verify linting and build succeed via `npm run lint` and `npm run build`.
- [x] 4.3 Run automated tests with `bun test` to ensure no regression.
