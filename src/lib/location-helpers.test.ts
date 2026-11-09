import { describe, it, expect } from "bun:test";
import "../test-dom";
import { isWarehouseLocation, isBranchLocation, filterBranchSchools, useRoamingLocation } from "./location-helpers";
import type { School } from "../types";

const { renderHook, act } = await import("@testing-library/react");

describe("location-helpers", () => {
  it("identifies warehouse locations correctly", () => {
    const wh: Pick<School, "type"> = { type: "warehouse" };
    const branch: Pick<School, "type"> = { type: "branch" };
    const main: Pick<School, "type"> = { type: "main" };

    expect(isWarehouseLocation(wh)).toBe(true);
    expect(isWarehouseLocation(branch)).toBe(false);
    expect(isWarehouseLocation(main)).toBe(false);
    expect(isWarehouseLocation(null)).toBe(false);
    expect(isWarehouseLocation(undefined)).toBe(false);
  });

  it("identifies branch and main school locations correctly", () => {
    const wh: Pick<School, "type"> = { type: "warehouse" };
    const branch: Pick<School, "type"> = { type: "branch" };
    const main: Pick<School, "type"> = { type: "main" };

    expect(isBranchLocation(branch)).toBe(true);
    expect(isBranchLocation(main)).toBe(true);
    expect(isBranchLocation(wh)).toBe(false);
    expect(isBranchLocation(null)).toBe(false);
  });

  it("filters branch schools excluding warehouses", () => {
    const list = [
      { id: "wh-1", type: "warehouse" },
      { id: "school-1", type: "branch" },
      { id: "school-2", type: "main" },
      { id: "school-3" },
    ];
    expect(filterBranchSchools(list)).toEqual([
      { id: "school-1", type: "branch" },
      { id: "school-2", type: "main" },
      { id: "school-3" },
    ]);
  });

  it("provides canonical useRoamingLocation behavior for global vs branch actors", () => {
    const whSchool: School = { id: "sch-wh", name: "Pusat", code: "PST", type: "warehouse" };
    const branchSchool: School = { id: "sch-1", name: "Cabang 1", code: "CB1", type: "branch" };
    const schools = [whSchool, branchSchool];

    // Global role can roam and switch
    const { result: globalRes } = renderHook(() =>
      useRoamingLocation(whSchool, schools, "warehouse_admin")
    );
    expect(globalRes.current.isGlobalUser).toBe(true);
    expect(globalRes.current.effectiveSchoolId).toBe("sch-wh");
    expect(globalRes.current.effectiveSchool?.name).toBe("Pusat");

    act(() => {
      globalRes.current.setSelectedSchoolId("sch-1");
    });
    expect(globalRes.current.effectiveSchoolId).toBe("sch-1");
    expect(globalRes.current.effectiveSchool?.name).toBe("Cabang 1");

    // Local branch role is strictly locked to activeSchool
    const { result: branchRes } = renderHook(() =>
      useRoamingLocation(branchSchool, schools, "school_admin")
    );
    expect(branchRes.current.isGlobalUser).toBe(false);
    expect(branchRes.current.effectiveSchoolId).toBe("sch-1");

    act(() => {
      branchRes.current.setSelectedSchoolId("sch-wh");
    });
    // Tetap terkunci ke branchSchool karena !isGlobalUser
    expect(branchRes.current.effectiveSchoolId).toBe("sch-1");
  });
});
