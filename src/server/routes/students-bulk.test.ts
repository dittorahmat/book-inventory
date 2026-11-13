import { describe, expect, it } from "bun:test";
import { studentsRouter } from "./students";
import { mockActor, restoreActor } from "./test-actor";
import { seedSchool } from "../lib/test-seed";

describe("studentsBulkRouter endpoints", () => {
  it("rejects non-drive URL with 400 on /parse-drive-url", async () => {
    mockActor("central_admin", null);

    const res = await studentsRouter.request("/parse-drive-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/not-drive" }),
    });

    expect(res.status).toBe(400);
    restoreActor();
  });

  it("handles /bulk-import and /batch-promote validation under studentsBulkRouter", async () => {
    const stamp = Date.now();
    const schoolId = await seedSchool(`blk-${stamp}`, `ALW-BULK-${stamp}`);

    // Invalid payload on bulk-import (empty students array)
    const emptyRes = await studentsRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, students: [] }),
    });
    expect(emptyRes.status).toBe(400);

    // Invalid payload on batch-promote (missing targetAcademicYear)
    const invalidPromote = await studentsRouter.request("/batch-promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    expect(invalidPromote.status).toBe(400);
  });
});
