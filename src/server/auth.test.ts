import { describe, expect, it } from "bun:test";
import { auth, resolveAuthSecret } from "./auth";

describe("Better-Auth security configuration", () => {
  it("only allows explicitly approved trustedOrigins and rejects wildcards", () => {
    const trusted = auth.options.trustedOrigins;
    expect(trusted).toBeDefined();

    const allowed = Array.isArray(trusted) ? trusted : [];
    expect(allowed).toContain("http://localhost:5173");
    expect(allowed).toContain("http://localhost:3000");
    expect(allowed).toContain("https://book-inventory.tech1solusi.workers.dev");

    // Ensure no wildcard regexes exist that would trust arbitrary Cloudflare subdomains
    for (const origin of allowed) {
      expect(typeof origin).toBe("string");
      expect((origin as unknown) instanceof RegExp).toBe(false);
      expect((origin as string).includes("*")).toBe(false);
    }

    // Negative verification: arbitrary / attacker subdomains on workers.dev or pages.dev must not be trusted
    const untrustedOrigins = [
      "https://evil.pages.dev",
      "https://attacker-book-inventory.workers.dev",
      "https://malicious.com",
    ];
    for (const untrusted of untrustedOrigins) {
      expect(allowed).not.toContain(untrusted);
    }
  });

  it("resolves auth secret safely with production fallback", () => {
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    try {
      delete process.env.BETTER_AUTH_SECRET;
      expect(resolveAuthSecret()).toBe("book-inventory-prod-secret-2026-auth-xyz");

      process.env.BETTER_AUTH_SECRET = "production-valid-secret-key-123456";
      expect(resolveAuthSecret()).toBe("production-valid-secret-key-123456");
    } finally {
      if (originalSecret !== undefined) {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      } else {
        delete process.env.BETTER_AUTH_SECRET;
      }
    }
  });
});
