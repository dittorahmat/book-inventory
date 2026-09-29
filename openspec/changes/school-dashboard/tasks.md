## 1. Backend aggregate endpoint

- [ ] 1.1 Implement `src/server/services/dashboard-summary.ts` computing coverage, funnel, payment health, attention counts, and grade/curriculum breakdown per school; verify with unit tests covering healthy coverage, shortfall, and zero-waiting-orders cases
- [ ] 1.2 Add `GET /api/dashboard/summary?schoolId=` in `src/server/routes/dashboard.ts` with `z.string().min(1)` validation and server-side branch isolation (branch_admin scoped to own school, cross-school rejected); verify with route tests for seeded string IDs, UUIDs, and the forbidden cross-school case
- [ ] 1.3 Register the dashboard route in the server index/worker; verify the endpoint responds 200 with the full payload shape via an integration test

## 2. Frontend shell and data layer

- [ ] 2.1 Add `recharts` dependency and lazy-load boundary for the dashboard; verify public portal bundle contains no recharts chunk (build output inspection)
- [ ] 2.2 Create `src/components/dashboard/dashboard-api.ts` and `useDashboard.ts` with try/catch error surfacing and retry; verify error state renders an explicit message with retry on endpoint failure (test with mocked failing fetch)
- [ ] 2.3 Create `src/views/DashboardView.tsx` shell with HQ comparison vs branch detail modes; verify central_admin sees all school cards and branch_admin sees only the assigned school

## 3. Dashboard content components

- [ ] 3.1 Build `DashboardKpis.tsx` (coverage hero with shortfall count, payment KPIs, scholarship pending); verify hero shows lowest-coverage school for HQ and own coverage for branch
- [ ] 3.2 Build `CoverageChart.tsx` and `FunnelChart.tsx` with Recharts styling overrides (no gridlines, rounded bordered tooltip, locked palette); verify against the anti-slop rules (neutral base, no gradient glow, consistent radius)
- [ ] 3.3 Build condition donut and grade/curriculum breakdown; verify the shortfall tier is flagged when waiting exceeds ready
- [ ] 3.4 Build `AttentionList.tsx` with all-clear empty state and navigation into existing workflow views; verify each entry routes to the correct filtered view

## 4. Integration and quality gates

- [ ] 4.1 Switch default post-login tab to Dashboard in `App.tsx` and add the Dashboard tab affordance (desktop + mobile nav); verify all pre-existing tabs still render with unchanged behavior
- [ ] 4.2 Add regression tests for every fixed API bug found during implementation in `src/server/routes/*.test.ts`; verify `bun test` passes
- [ ] 4.3 Run the full project checklist (`bun run db:push`, `npm run type-check`, `npm run lint`, `npm run build`, `bun run check:file-size`) and verify zero errors and no file over 300 lines
