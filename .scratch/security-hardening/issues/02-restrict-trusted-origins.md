# 02: Restrict Better-Auth trustedOrigins to Authorized Domain Allowlist

**What to build:**
Replace overly broad wildcard regular expressions (`/^https:\/\/.*\.workers\.dev$/`, `/^https:\/\/.*\.pages\.dev$/`) in `src/server/auth.ts` with explicit, known application origins to prevent third-party Cloudflare Pages/Workers from making credentialed cross-origin auth requests.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Pin `trustedOrigins` in `src/server/auth.ts` to exact domains (`http://localhost:5173`, `http://localhost:3000`, `https://book-inventory.tech1solusi.workers.dev`).
- [ ] Add regression test verifying untrusted third-party origins on `pages.dev` / `workers.dev` are not treated as trusted origins.
