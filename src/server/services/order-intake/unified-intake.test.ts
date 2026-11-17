import { describe, expect, it } from "bun:test";
import { db } from "../../../db";
import { executeStudentOrderIntake } from "./unified-intake";

describe("UnifiedStudentOrderIntake Seam", () => {
  it("menangani domain buku dan mengembalikan struktur hasil pesanan buku", async () => {
    const out = await executeStudentOrderIntake(db, {
      domain: "buku",
      payload: {
        studentId: "non-existent-student",
        orderType: "regular",
        looseItems: [],
      },
    });

    expect(out.domain).toBe("buku");
    expect(out.result.ok).toBe(false);
  });

  it("menangani domain seragam dan mengembalikan struktur hasil pesanan seragam", async () => {
    const out = await executeStudentOrderIntake(db, {
      domain: "seragam",
      payload: {
        studentId: "non-existent-student",
        homeAddress: "Jl. Merdeka No 123",
        academicYear: "2026/2027",
        orderType: "regular",
        items: [{ variantId: "var-1", size: "M", quantity: 1 }],
      },
    });

    expect(out.domain).toBe("seragam");
    expect(out.result.ok).toBe(false);
  });
});


