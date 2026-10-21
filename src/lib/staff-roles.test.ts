import { describe, expect, it } from "bun:test";
import {
  getDefaultTabForRole,
  getRoleBadgeLabel,
  isBookWarehouseStaffRole,
  isCentralRole,
  isLogisticsRole,
  isSchoolRole,
  isUniformStaffRole,
} from "./staff-roles";

describe("staff-roles helper", () => {
  it("determines correct default tab per role", () => {
    expect(getDefaultTabForRole("warehouse_uniforms_admin")).toBe("uniforms");
    expect(getDefaultTabForRole("warehouse_books_admin")).toBe("internal_orders");
    expect(getDefaultTabForRole("branch_admin")).toBe("internal_orders");
    expect(getDefaultTabForRole("school_admin")).toBe("internal_orders");
    expect(getDefaultTabForRole("central_admin")).toBe("dashboard");
    expect(getDefaultTabForRole("warehouse_admin")).toBe("dashboard");
    expect(getDefaultTabForRole(undefined)).toBe("dashboard");
  });

  it("determines correct badge label per role", () => {
    expect(getRoleBadgeLabel("central_admin")).toBe("HQ Central Admin");
    expect(getRoleBadgeLabel("warehouse_uniforms_admin")).toBe("Admin Gudang Seragam");
    expect(getRoleBadgeLabel("warehouse_books_admin")).toBe("Admin Gudang Buku");
    expect(getRoleBadgeLabel("warehouse_admin")).toBe("Admin Gudang");
    expect(getRoleBadgeLabel("branch_admin")).toBe("Branch Admin");
    expect(getRoleBadgeLabel("school_admin")).toBe("Branch Admin");
    expect(getRoleBadgeLabel(undefined)).toBe("Staf");
  });

  it("evaluates role category predicates", () => {
    expect(isCentralRole("central_admin")).toBe(true);
    expect(isCentralRole("branch_admin")).toBe(false);

    expect(isUniformStaffRole("warehouse_uniforms_admin")).toBe(true);
    expect(isUniformStaffRole("warehouse_admin")).toBe(true);
    expect(isUniformStaffRole("warehouse_books_admin")).toBe(false);

    expect(isBookWarehouseStaffRole("warehouse_books_admin")).toBe(true);
    expect(isBookWarehouseStaffRole("warehouse_admin")).toBe(true);
    expect(isBookWarehouseStaffRole("warehouse_uniforms_admin")).toBe(false);

    expect(isLogisticsRole("warehouse_admin")).toBe(true);
    expect(isLogisticsRole("branch_admin")).toBe(false);

    expect(isSchoolRole("branch_admin")).toBe(true);
    expect(isSchoolRole("school_admin")).toBe(true);
    expect(isSchoolRole("central_admin")).toBe(false);
  });
});
