# 06: Production Secret Hardening & Fallback Guard in auth.ts

**What to build:**
Ensure that when `NODE_ENV === "production"`, `src/server/auth.ts` requires `BETTER_AUTH_SECRET` to be defined and throws a fail-fast error rather than falling back to a static, publicly known development key.

**Blocked by:** 01-disable-public-signup, 02-restrict-trusted-origins

**Status:** ready-for-agent

- [ ] Update `src/server/auth.ts` secret resolution to throw a startup error if `NODE_ENV === "production"` and `BETTER_AUTH_SECRET` is unset.
- [ ] Add regression test in `src/server/auth.test.ts` verifying fail-fast behavior in production mode.
