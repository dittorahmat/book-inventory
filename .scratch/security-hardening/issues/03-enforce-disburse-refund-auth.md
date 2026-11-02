# 03: Enforce Central/Finance Role Authorization on Refund Disbursement

**What to build:**
Enforce strict `requireCentralAdmin` (or finance role) on `POST /api/payments/disburse-refund` so that branch administrators cannot disburse financial refunds or execute financial transactions across campuses.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Update `src/server/routes/payments.ts` at `/disburse-refund` to require central admin authorization via `requireCentralAdmin(await resolveRequestActor(c))`.
- [ ] Add regression test in `src/server/routes/payments.test.ts` verifying that `branch_admin` receives 403 Forbidden on `POST /api/payments/disburse-refund` and only `central_admin` can disburse.
