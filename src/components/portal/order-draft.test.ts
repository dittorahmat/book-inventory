import { describe, expect, it } from "bun:test";
import { allocationForChoice, buildSatuanPkg, calcDraftTotal, draftRemainder } from "./order-draft";

describe("portal order draft (single totals seam)", () => {
  it("computes book total identically to payload (package vs loose + WPR)", () => {
    expect(calcDraftTotal({ packageMode: true, packagePrice: 900000, looseTotal: 100000, wprFee: 750000 })).toBe(900000);
    expect(calcDraftTotal({ packageMode: false, packagePrice: 0, looseTotal: 100000, wprFee: 750000 })).toBe(850000);
    expect(calcDraftTotal({ packageMode: false, packagePrice: 0, looseTotal: 100000, wprFee: 0 })).toBe(100000);
  });

  it("presets full vs partial allocation and clamps remainder", () => {
    expect(allocationForChoice("full", 850000)).toBe(850000);
    expect(allocationForChoice("partial", 850001)).toBe(Math.round(850001 / 2));
    expect(draftRemainder(850000, 900000)).toBe(0);
    expect(draftRemainder(850000, 400000)).toBe(450000);
  });

  it("builds satuan pkg once with WPR included a single time", () => {
    const pkg = buildSatuanPkg({
      student: {
        id: "st", nis: "1", name: "A", gradeLevel: "1", curriculumType: "international",
        academicYear: "2026/2027", status: "active", isScholarship: false, schoolId: "s", schoolName: "S",
        detectedStatus: "aktif", currentGradeLevel: "1", targetGradeLevel: "1", canOrder: true, orderBlockedReason: null,
      },
      looseSelections: [{ bookId: "b1", quantity: 2 }],
      looseTotal: 100000,
      wprFee: 750000,
    });
    expect(pkg.id).toBe("satuan");
    expect(pkg.price).toBe(850000);
    expect(pkg.totalItemsCount).toBe(1);
    expect(pkg.items).toEqual([]);
  });
});
