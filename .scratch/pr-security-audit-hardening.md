## Summary of Changes

This Pull Request addresses the security audit findings and implements vertical slice hardening across authentication, authorization, intake payload validation, and PII protection.

### Hardening Highlights

1. **Authentication & Origins Hardening (`better-auth`)**:
   - Closed public self-registration by blocking `/api/auth/sign-up/*` fail-closed across all HTTP methods with `403 Forbidden` (`src/server/index.ts`).
   - Restricted `trustedOrigins` in `src/server/auth.ts` to exact literal domain strings (`localhost`, production workers domain), eliminating wildcards (`*.workers.dev`, `*.pages.dev`).
   - Replaced development fallback for `BETTER_AUTH_SECRET` in production mode (`resolveAuthSecret()` throws fail-fast in production if secret is unset).

2. **Authorization Enforcement**:
   - Enforced `requireCentralAdmin` on `POST /api/payments/disburse-refund` to restrict refund payouts strictly to Central Admin (`src/server/routes/payments.ts`).

3. **Public Search PII Leakage Protection**:
   - Excluded unmasked `parentEmail` and `parentPhone` from public student order search views (`src/server/services/public-order.ts`).

4. **Worker Heap DoS & Upload Size Protection**:
   - Introduced canonical `base64UploadSchema` with `MAX_BASE64_UPLOAD_CHARS = 7_000_000` (~5MB decoded binary) across all book and uniform intake routes (`scholarshipProofBase64`, `financeProofBase64`, `paymentProofBase64`, `letterProofBase64`, and `photoProofBase64`).
   - Created repo gate `check:base64-schemas` (`scripts/check-base64-schemas.ts`) wired to pre-commit and CI (`.github/workflows/checks.yml`) to prevent unconstrained base64 uploads from entering the codebase.

5. **Conventions & Standards**:
   - Added anti-recurrence mandate §0.49 to `AGENTS.md` covering origins, registration blocking, base64 schema constraints, and fail-closed secrets.
   - Documented sub-agent asynchronous notification discipline (anti-polling) and public order routing pointers.

### Verification

- `bun run check:all` passed completely:
  - TypeScript strict: 0 errors
  - ESLint: 0 errors
  - All repo gates passed (`check:clean-artifacts`, `check:file-size`, `check:imports`, `check:api-contract`, `check:route-tests`, `check:validators`, `check:base64-schemas`, `check:dead`, `check:no-any`, `check:canonical-helpers`, `check:single-writer`, `check:d1-writes`, `check:d1-error-mapping`, `check:test-isolation`, `check:doc-numbers`, `check:string-packing`, `check:no-silent-catch`, `check:seed-integrity`, `check:plans`).
  - Production build: `vite build` completed cleanly.
  - Tests: **640 passed**, 12 skipped, 0 failed across 128 test files.
