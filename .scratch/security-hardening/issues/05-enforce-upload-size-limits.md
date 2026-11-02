# 05: Enforce Payload Size Constraints on Public Base64 Document Uploads

**What to build:**
Add explicit character length constraints (`.max(7_000_000)`) on all base64 string fields in public order and payment confirmation Zod schemas to prevent memory exhaustion / denial of service in serverless worker runtimes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Add `.max(7_000_000)` constraints on base64 fields (`scholarshipProofBase64`, `financeProofBase64`, `paymentProofBase64`) in `src/server/routes/public-orders.ts`.
- [ ] Add regression tests in `src/server/routes/public-orders.test.ts` verifying that payloads exceeding the limit are rejected fast with 400 Bad Request without decoding into memory.
