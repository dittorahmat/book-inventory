import { describe, expect, it } from "bun:test";
import {
  AccessHttpError,
  assertLocationAllowed,
  requireLogisticsRole,
  resolveLocationScope,
  type AccessActor,
} from "./access-scope";

const LOCS = [{ id: "school-alw-1" }, { id: "school-alw-2" }, { id: "school-warehouse" }];
const schoolA: AccessActor = { role: "school_admin", schoolId: "school-alw-1" };
const branchA: AccessActor = { role: "branch_admin", schoolId: "school-alw-1" };
const warehouse: AccessActor = { role: "warehouse_admin", schoolId: "school-warehouse" };
const central: AccessActor = { role: "central_admin", schoolId: null };

describe("resolveLocationScope (pure isolation contract)", () => {
  it("locks scoped roles to their own location", () => {
    expect(resolveLocationScope(schoolA, undefined, LOCS)).toEqual(["school-alw-1"]);
    expect(resolveLocationScope(schoolA, "school-alw-1", LOCS)).toEqual(["school-alw-1"]);
    expect(resolveLocationScope(branchA, undefined, LOCS)).toEqual(["school-alw-1"]);
    expect(resolveLocationScope(warehouse, undefined, LOCS)).toEqual(["school-warehouse"]);
  });

  it("rejects scoped access to other locations", () => {
    expect(() => resolveLocationScope(schoolA, "school-alw-2", LOCS)).toThrow(AccessHttpError);
    expect(() => resolveLocationScope(warehouse, "school-alw-1", LOCS)).toThrow(AccessHttpError);
  });

  it("rejects scoped actors without assignment", () => {
    expect(() => resolveLocationScope({ role: "school_admin", schoolId: null }, undefined, LOCS)).toThrow(AccessHttpError);
  });

  it("lets central admin roam but validates ids", () => {
    expect(resolveLocationScope(central, undefined, LOCS).length).toBe(3);
    expect(resolveLocationScope(central, "school-alw-2", LOCS)).toEqual(["school-alw-2"]);
    expect(() => resolveLocationScope(central, "nope", LOCS)).toThrow(AccessHttpError);
  });

  it("keeps unauthenticated callers on legacy open access", () => {
    expect(resolveLocationScope(null, undefined, LOCS).length).toBe(3);
    expect(resolveLocationScope(null, "school-alw-2", LOCS)).toEqual(["school-alw-2"]);
  });
});

describe("assertLocationAllowed", () => {
  it("allows own location, forbids others, 404s unknown", () => {
    expect(() => assertLocationAllowed(schoolA, "school-alw-1", LOCS)).not.toThrow();
    expect(() => assertLocationAllowed(schoolA, "school-alw-2", LOCS)).toThrow(AccessHttpError);
    expect(() => assertLocationAllowed(schoolA, "ghost", LOCS)).toThrow(AccessHttpError);
    expect(() => assertLocationAllowed(central, "school-alw-2", LOCS)).not.toThrow();
    expect(() => assertLocationAllowed(null, "school-alw-2", LOCS)).not.toThrow();
  });
});

describe("requireLogisticsRole", () => {
  it("only admits central and warehouse admins when identity is known", () => {
    expect(() => requireLogisticsRole(central)).not.toThrow();
    expect(() => requireLogisticsRole(warehouse)).not.toThrow();
    expect(() => requireLogisticsRole(schoolA)).toThrow(AccessHttpError);
    expect(() => requireLogisticsRole(branchA)).toThrow(AccessHttpError);
    expect(() => requireLogisticsRole(null)).not.toThrow();
  });
});
