import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { students, schools } from "../../db/schema";
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

    // Valid payload with modern curriculumType and optional fields
    mockActor("central_admin", null);
    try {
      const validBulkRes = await studentsRouter.request("/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          students: [
            {
              nis: `2627-${stamp}-1`,
              name: "Siswa Inter",
              gradeLevel: "1",
              rombel: "1 INTER 1",
              curriculumType: "INTER",
              gender: "male",
              stream: null,
              intakeType: "baru",
              academicYear: "2026/2027",
              parentEmail: "ortu@example.com",
            },
            {
              nis: `2627-${stamp}-2`,
              name: "Siswa MQ",
              gradeLevel: "2",
              curriculumType: "MQ",
              gender: "female",
              stream: "IPA",
              intakeType: "kenaikan",
              academicYear: "2026/2027",
              parentEmail: null,
            },
          ],
        }),
      });
      expect(validBulkRes.status).toBe(200);

      // Verifikasi persistensi database untuk curriculumType, stream, intakeType, dan parentEmail
      const rows = await db.select().from(students).where(eq(students.schoolId, schoolId));
      const s1 = rows.find((r) => r.nis === `2627-${stamp}-1`);
      expect(s1).toBeDefined();
      expect(s1?.curriculumType).toBe("INTER");
      expect(s1?.intakeType).toBe("baru");
      expect(s1?.parentEmail).toBe("ortu@example.com");

      const s2 = rows.find((r) => r.nis === `2627-${stamp}-2`);
      expect(s2).toBeDefined();
      expect(s2?.curriculumType).toBe("MQ");
      expect(s2?.stream).toBe("IPA");
      expect(s2?.intakeType).toBe("kenaikan");
      expect(s2?.parentEmail).toBeNull();
    } finally {
      restoreActor();
      await db.delete(students).where(eq(students.schoolId, schoolId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
