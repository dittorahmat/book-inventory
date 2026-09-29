## Context

See proposal.md (Why) for motivation. Current state shaping this design:

- Frontend: React 19 + Vite + Tailwind CSS 3.4, no chart or component library installed; `clsx` + `tailwind-merge` already present. Existing views fetch per-entity endpoints directly (`/api/book-items?schoolId=`, `/api/schools`).
- Backend: Hono + Drizzle ORM on SQLite/D1. All metric source tables exist (`book_items`, `package_items`, `students`, `student_book_orders`, `order_payments`, `purchase_orders`, `transfer_shipments`, `book_returns`). No schema change needed.
- Constraints from project conventions: 300-line file-size gate (new feature code MUST live in split files), flexible identifier validation (`z.string().min(1)`, never `z.string().uuid()`), anti-silent-failure (every fetch has error surfacing), anti-slop frontend rules (neutral base, locked radius scale, no gradient glow).
- Deploy target includes Cloudflare Workers: frontend bundle size is sensitive.

## Goals / Non-Goals

**Goals:**
- One-screen operational summary with a single hero number (coverage) plus its diagnosis (funnel).
- Zero new UI-system migration: new code follows the existing Tailwind + lucide style of current views.
- One backend round-trip per dashboard load.

**Non-Goals:**
- Historical trends / time-series charts (no grouping infrastructure yet; reserved for V2).
- Per-title low-stock analysis (join-heavy; reserved for V2).
- Real-time updates (polling/websockets); static load + manual refresh is sufficient for V1.
- Full shadcn/ui migration; only its chart-composition pattern is borrowed.

## Decisions

### Charting: Recharts only, no Tremor, no full shadcn
Recharts v3 is the rendering engine underneath both shadcn charts and Tremor, so raw Recharts gives the same output without their opinion layer or extra bundle (~50kB gzip vs ~70kB Tremor, 500kB Nivo). Only 3 charts are needed (coverage bar, funnel bar, condition donut), which does not justify a dashboard kit. Recharts default styling MUST be overridden (no gridlines, `rounded-xl` bordered tooltip, palette locked to `#1877F2`/Emerald/Amber/Red) to satisfy the anti-slop gate. Alternative considered: Tremor — rejected because its opinionated theming fights the project's palette/radius locks; full shadcn — rejected as a multi-file migration (CSS vars, animation plugin, path aliases) disproportionate to one screen.

### Single aggregate endpoint with a service layer
`GET /api/dashboard/summary?schoolId=` computed by `src/server/services/dashboard-summary.ts`, keeping the route file to validation + routing per the file-size gate. Alternative considered: frontend fan-out over existing endpoints — rejected (N+1 latency, duplicated aggregation logic in the client, harder branch-isolation enforcement).

### Branch isolation enforced server-side
The service layer resolves the effective school scope from the session role, never trusting the query param alone for `branch_admin`. Frontend hiding alone is not a security boundary.

### Lazy-load the dashboard bundle
`DashboardView` loads via `React.lazy` so the public parent portal never downloads Recharts. The default-tab switch in `App.tsx` keeps the lazy boundary intact.

### File split honoring the 300-line gate from day one
Shell view (`DashboardView.tsx`) + `src/components/dashboard/` (`DashboardKpis`, `CoverageChart`, `FunnelChart`, `AttentionList`, `useDashboard` hook, `dashboard-api`) + `src/server/routes/dashboard.ts` + `src/server/services/dashboard-summary.ts`. No new-code JSX may be inlined into existing oversized views.

## Risks / Trade-offs

- [Risk] Recharts v3 API drift vs older examples online -> Mitigation: follow the current shadcn chart docs pattern (composition over wrapper) and pin the major version in `package.json`.
- [Risk] Aggregate query cost on D1 as data grows (multi-table counts per load) -> Mitigation: counts only, no row fetching; add per-school scoping to every query; defer caching to V2 if load times regress.
- [Risk] Coverage definition disputes (e.g. should `reserved` packages count as ready?) -> Mitigation: spec pins `in_stock` only; revisit explicitly if operations disagrees.
- [Trade-off] No trend charts in V1 means week-over-week questions stay unanswered; accepted to ship the core decision loop first.

## Migration Plan

1. Add `recharts` dependency; verify `npm run build` passes for both Vite client and worker bundle.
2. Ship backend endpoint + service with tests covering seeded string IDs and UUIDs, plus the branch-isolation rejection case.
3. Ship frontend behind the new default tab; existing tabs untouched.
4. Run the project's quality checklist (`db:push`, remote D1 check — no-op expected as schema is unchanged, `type-check`, `lint`, `build`, `test`, `check:file-size`).
5. Rollback: revert the default tab in `App.tsx` to `student_orders`; the endpoint is additive and safe to leave.

## Open Questions

None blocking. Chart micro-copy wording (Indonesian labels for funnel stages) can be finalized during implementation without changing specs or tasks.
