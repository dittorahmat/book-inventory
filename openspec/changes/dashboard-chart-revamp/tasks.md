## 1. Central Admin Scatter Plot & Horizontal Ranking

- [x] 1.1 Implement `src/components/dashboard/BranchHealthScatter.tsx` using Recharts `<ScatterChart>` to map school branches across coverage (X) and payment (Y) with quadrant reference guidelines.
- [x] 1.2 Revamp `src/components/dashboard/CoverageChart.tsx` into horizontal ranked bars with threshold tones and legible school labels.
- [x] 1.3 Update `src/components/dashboard/ComparisonOverview.tsx` to feature an aggregate stepped pipeline process flow.

## 2. Integration & Layout Alignment

- [x] 2.1 Update `src/views/DashboardView.tsx` to integrate `BranchHealthScatter` into the central comparison view layout.
- [x] 2.2 Verify file sizes (<400 lines) via `bun run check:file-size`.

## 3. Verification & Quality Suite

- [x] 3.1 Verify TypeScript type checking via `bun run type-check`.
- [x] 3.2 Verify linting and build via `npm run lint` and `npm run build`.
- [x] 3.3 Run automated tests with `bun test`.
