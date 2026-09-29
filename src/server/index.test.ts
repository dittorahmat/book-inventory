import { describe, expect, it } from "bun:test";
import { app } from "./index";

describe("Global API error envelope", () => {
  it("returns JSON without internals on unexpected errors", async () => {
    app.get("/__test-boom", () => {
      throw new Error("secret-stack-boom");
    });
    const res = await app.request("/__test-boom");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    const text = await res.text();
    expect(text).not.toContain("secret-stack-boom");
    const json = JSON.parse(text);
    expect(json.success).toBe(false);
    expect(typeof json.message).toBe("string");
    expect(json.message.length).toBeGreaterThan(0);
  });
});
