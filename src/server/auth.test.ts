import { describe, expect, it } from "bun:test";
import { auth } from "./auth";

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
  });
});
