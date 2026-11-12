import { describe, expect, it } from "bun:test";
import { findMatchingUniformSelection } from "./uniform-selection";
import type { UniformCatalog, UniformStudent } from "./uniform-types";

describe("uniform-selection", () => {
  const mockStudent: UniformStudent = {
    id: "std-1",
    nis: "12345",
    name: "Ahmad",
    gender: "male",
    gradeLevel: "1",
    academicYear: "2026/2027",
    status: "new",
    schoolId: "sch-1",
    schoolName: "SD 1",
    parentName: "Ayah",
    parentPhone: "0812345",
    detectedStatus: "baru",
    currentGradeLevel: "1",
    targetGradeLevel: "1",
    curriculumType: "nasional",
    isScholarship: false,
    canOrder: true,
    orderBlockedReason: null,
  };

  const mockCatalog: UniformCatalog = {
    packages: [
      {
        id: "pkg-sd-ikh",
        code: "PKG-SD-IKH",
        name: "Paket Bahan Seragam Harian SD Ikhwan",
        academicYear: "2026/2027",
        price: 500000,
        readyQty: 10,
        bom: [{ variantId: "v-kain-1", variantName: "Kain", kind: "kain_harian", size: "—", quantity: 1 }],
      },
    ],
    variants: [
      {
        id: "v-kain-1",
        code: "K-SD-IKH",
        name: "Kain Kemeja",
        kind: "kain_harian",
        gender: "male",
        jenjang: "sd",
        academicYear: "2026/2027",
        price: 50000,
        sizeChartUrl: null,
        sizes: [],
        stock: [],
      },
      {
        id: "v-ol-sd-ikh",
        code: "OL-SD-IKH",
        name: "BAJU OLAHRAGA (SD Ikhwan)",
        kind: "olahraga",
        gender: "male",
        jenjang: "sd",
        academicYear: "2026/2027",
        price: 150000,
        sizeChartUrl: null,
        sizes: ["S", "M"],
        stock: [],
      },
    ],
  };

  it("finds matching package and olahraga variant accurately", () => {
    const match = findMatchingUniformSelection(mockStudent, mockCatalog);
    expect(match.package?.id).toBe("pkg-sd-ikh");
    expect(match.olahraga?.id).toBe("v-ol-sd-ikh");
  });
});
