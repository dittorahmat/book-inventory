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

  it("throws fail-fast error in production mode when BETTER_AUTH_SECRET is missing", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.BETTER_AUTH_SECRET;
      expect(() => resolveAuthSecret()).toThrow("BETTER_AUTH_SECRET environment variable is strictly required");

      process.env.BETTER_AUTH_SECRET = "production-valid-secret-key-123456";
      expect(resolveAuthSecret()).toBe("production-valid-secret-key-123456");
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret !== undefined) {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      } else {
        delete process.env.BETTER_AUTH_SECRET;
      }
    }
  });
});
