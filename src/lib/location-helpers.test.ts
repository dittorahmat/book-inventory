import { describe, it, expect } from "bun:test";
import { isWarehouseLocation, isBranchLocation } from "./location-helpers";
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
});
