import { describe, it, expect } from "bun:test";
import { isWarehouseLocation, isBranchLocation, filterBranchSchools } from "./location-helpers";
import type { School } from "../types";

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
});
