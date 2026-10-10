import { describe, expect, it } from "bun:test";
import {
  AccessHttpError,
  assertLocationAllowed,
  assertShipmentVisible,
  requireAuthenticatedActor,
  requireCentralAdmin,
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

describe("requireAuthenticatedActor", () => {
  it("menolak pemanggil anonim dengan 401", () => {
    try {
      requireAuthenticatedActor(null);
      throw new Error("seharusnya melempar 401");
    } catch (err) {
      expect(err).toBeInstanceOf(AccessHttpError);
      expect((err as AccessHttpError).status).toBe(401);
      expect((err as AccessHttpError).message).toMatch(/login/i);
    }
  });

  it("meloloskan semua peran staf yang terautentikasi", () => {
    expect(requireAuthenticatedActor(central)).toEqual(central);
    expect(requireAuthenticatedActor(warehouse)).toEqual(warehouse);
    expect(requireAuthenticatedActor(schoolA)).toEqual(schoolA);
    expect(requireAuthenticatedActor(branchA)).toEqual(branchA);
  });
});

describe("requireCentralAdmin", () => {
  it("menolak pemanggil anonim dengan 401", () => {
    try {
      requireCentralAdmin(null);
      throw new Error("seharusnya melempar 401");
    } catch (err) {
      expect(err).toBeInstanceOf(AccessHttpError);
      expect((err as AccessHttpError).status).toBe(401);
      expect((err as AccessHttpError).message).toMatch(/login/i);
    }
  });

  it("menolak peran non-pusat dengan 403", () => {
    for (const actor of [warehouse, schoolA, branchA]) {
      try {
        requireCentralAdmin(actor);
        throw new Error(`seharusnya melempar 403 untuk ${actor.role}`);
      } catch (err) {
        expect(err).toBeInstanceOf(AccessHttpError);
        expect((err as AccessHttpError).status).toBe(403);
      }
    }
  });

  it("meloloskan admin pusat", () => {
    expect(requireCentralAdmin(central)).toEqual(central);
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

describe("assertShipmentVisible (T4 seam)", () => {
  it("lets central roam, locks scoped actors to origin/destination sides", () => {
    expect(() => assertShipmentVisible(central, "school-alw-1", "school-alw-2")).not.toThrow();
    expect(() => assertShipmentVisible(schoolA, "school-alw-1", "school-alw-2")).not.toThrow();
    expect(() => assertShipmentVisible(schoolA, "school-alw-2", "school-alw-1")).not.toThrow();
    expect(() => assertShipmentVisible({ role: "school_admin", schoolId: null }, "school-alw-1", "school-alw-2")).toThrow(
      AccessHttpError
    );
  });

  it("rejects third-party locations with 403 and keeps the legacy message", () => {
    try {
      assertShipmentVisible(schoolA, "school-alw-2", "school-warehouse");
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(AccessHttpError);
      expect((err as AccessHttpError).status).toBe(403);
      expect((err as AccessHttpError).message).toBe("Akses ke transfer lokasi lain dilarang");
    }
    try {
      assertShipmentVisible(schoolA, "school-alw-2", undefined, "Akses hapus transfer lokasi lain dilarang");
      expect(true).toBe(false);
    } catch (err) {
      expect((err as AccessHttpError).message).toBe("Akses hapus transfer lokasi lain dilarang");
    }
  });
});
