import { describe, expect, test } from "bun:test";
import { eligibilityStatus, evaluateStudentEligibility } from "./student-eligibility";

describe("evaluateStudentEligibility", () => {
  test("murid aktif dan promosi boleh memesan", () => {
    expect(evaluateStudentEligibility({ status: "active" })).toEqual({ ok: true });
    expect(evaluateStudentEligibility({ status: "promoted" })).toEqual({ ok: true });
  });

  test("murid belum terverifikasi ditolak dengan pesan verifikasi", () => {
    for (const status of ["new_pending", "rejected"]) {
      const result = evaluateStudentEligibility({ status });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("not_allowed");
        expect(result.message).toContain("verifikasi");
        expect(eligibilityStatus(result.reason)).toBe(403);
      }
    }
  });

  test("status non-aktif lain juga ditolak, bukan hanya new_pending", () => {
    const result = evaluateStudentEligibility({ status: "graduated" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(eligibilityStatus(result.reason)).toBe(403);
  });

  test("murid tidak ditemukan = 404", () => {
    const result = evaluateStudentEligibility(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(eligibilityStatus(result.reason)).toBe(404);
  });
});
