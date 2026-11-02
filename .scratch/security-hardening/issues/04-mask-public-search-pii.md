# 04: Mask/Omit Student and Parent Contact PII on Public Intake Search

**What to build:**
Exclude unmasked `parentEmail` and `parentPhone` from public search response views (`toBookSearchView` and `toUniformSearchView`) in `src/server/services/public-order.ts`, protecting sensitive PII from public scraping while preserving normal portal checkout.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Remove `parentEmail` and `parentPhone` from `toBookSearchView` and `toUniformSearchView` in `src/server/services/public-order.ts`.
- [ ] Verify portal student intake flow continues to function properly (using `parentPhoneManual` during payment).
- [ ] Add regression tests in `src/server/routes/public-orders.test.ts` verifying that `/api/public/orders/search-students` returns no `parentEmail` or `parentPhone`.
