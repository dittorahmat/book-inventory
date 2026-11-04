import { describe, expect, it } from "bun:test";
import { studentsRouter } from "./students";
import { mockActor, restoreActor } from "./test-actor";

describe("POST /api/students/parse-drive-url", () => {
  it("rejects non-drive URL with 400", async () => {
    mockActor("central_admin", null);

    const res = await studentsRouter.request("/parse-drive-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/not-drive" }),
    });

    expect(res.status).toBe(400);
    restoreActor();
  });
});
