# 01: Disallow Public Self-Registration and Restrict Better-Auth Signup

**What to build:**
Disable public account self-registration on the Better-Auth API (`/api/auth/sign-up/email`) so that only authenticated central administrators via `POST /api/users` can create staff accounts with assigned roles. Unauthenticated calls to sign-up must be rejected with 403 Forbidden.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Add `disableSignUp: true` and `autoSignIn: false` to `emailAndPassword` configuration in `src/server/auth.ts`, or intercept `/api/auth/sign-up/*` routes in Hono before Better-Auth handler.
- [ ] Ensure `POST /api/auth/sign-up/email` returns 403 Forbidden when called unauthenticated.
- [ ] Add regression test verifying unauthenticated callers cannot create accounts or escalate privileges.
