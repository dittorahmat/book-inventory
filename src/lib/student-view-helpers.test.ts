import { describe, expect, it } from "bun:test";
import { resolveDefaultStudentSchoolId, resolveFormDefaultSchoolId } from "./student-view-helpers";
import type { School } from "../types";

describe("student-view-helpers", () => {
  const warehouseSchool: School = {
    id: "wh-1",
    name: "Gudang Logistik Al Wildan",
    code: "WH-ALW",
    type: "warehouse",
  };

  const branchSchool: School = {
    id: "school-alw-1",
    name: "Al Wildan 1 BSD",
    code: "ALW-1",
    type: "branch",
  };

  describe("resolveDefaultStudentSchoolId", () => {
    it("mengembalikan 'all' untuk central_admin meskipun activeSchool adalah cabang", () => {
      expect(resolveDefaultStudentSchoolId("central_admin", branchSchool)).toBe("all");
    });

    it("mengembalikan 'all' untuk peran gudang (warehouse_admin, warehouse_books_admin, warehouse_uniforms_admin)", () => {
      expect(resolveDefaultStudentSchoolId("warehouse_admin", branchSchool)).toBe("all");
      expect(resolveDefaultStudentSchoolId("warehouse_books_admin", branchSchool)).toBe("all");
      expect(resolveDefaultStudentSchoolId("warehouse_uniforms_admin", branchSchool)).toBe("all");
    });

    it("mengembalikan 'all' jika activeSchool adalah warehouse meskipun peran staf undefined / null", () => {
      expect(resolveDefaultStudentSchoolId(undefined, warehouseSchool)).toBe("all");
    });

    it("mengembalikan id cabang jika user adalah branch_admin atau school_admin di sekolah cabang", () => {
      expect(resolveDefaultStudentSchoolId("branch_admin", branchSchool)).toBe("school-alw-1");
      expect(resolveDefaultStudentSchoolId("school_admin", branchSchool)).toBe("school-alw-1");
    });

    it("mengembalikan 'all' jika activeSchool null dan role adalah branch_admin", () => {
      expect(resolveDefaultStudentSchoolId("branch_admin", null)).toBe("all");
    });
  });

  describe("resolveFormDefaultSchoolId", () => {
    it("mengembalikan null jika activeSchool adalah gudang dan filter sedang 'all'", () => {
      expect(resolveFormDefaultSchoolId(warehouseSchool, "all")).toBeNull();
      expect(resolveFormDefaultSchoolId(warehouseSchool, "school-alw-1")).toBe("school-alw-1");
    });

    it("mengembalikan null jika filter view sedang 'all'", () => {
      expect(resolveFormDefaultSchoolId(branchSchool, "all")).toBeNull();
      expect(resolveFormDefaultSchoolId(null, "all")).toBeNull();
    });

    it("mengembalikan selectedSchoolId atau activeSchool.id jika cabang spesifik terpilih", () => {
      expect(resolveFormDefaultSchoolId(branchSchool, "school-alw-1")).toBe("school-alw-1");
      expect(resolveFormDefaultSchoolId(null, "school-alw-2")).toBe("school-alw-2");
      expect(resolveFormDefaultSchoolId(branchSchool, "")).toBe("school-alw-1");
    });
  });
});
