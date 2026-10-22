import { describe, expect, test } from "bun:test";
import { DESKTOP_TABS, TAB_IDS, getVisibleTabsForRole } from "./staff-tabs";

describe("staff-tabs", () => {
  test("urutan render tab staf terkunci", () => {
    expect(DESKTOP_TABS.map((tab) => tab.id)).toEqual([
      "dashboard",
      "internal_orders",
      "students",
      "uniforms",
      "student_orders",
      "packages",
      "procurement",
      "returns",
      "inventory",
      "catalog",
      "reconciliation",
      "reports",
      "settings",
    ]);
  });

  test("TAB_IDS dan daftar render memuat himpunan tab yang sama", () => {
    expect([...DESKTOP_TABS.map((tab) => tab.id)].sort()).toEqual([...TAB_IDS].sort());
    expect(new Set(TAB_IDS).size).toBe(TAB_IDS.length);
  });

  test("setiap tab punya label, ikon, dan predikat visibilitas", () => {
    for (const tab of DESKTOP_TABS) {
      expect(typeof tab.label).toBe("function");
      expect(typeof tab.visible).toBe("function");
      expect(tab.icon).toBeTruthy();
      expect(tab.label("central_admin").length).toBeGreaterThan(0);
    }
  });

  test("central admin melihat semua tab", () => {
    expect(getVisibleTabsForRole("central_admin")).toEqual(DESKTOP_TABS.map((tab) => tab.id));
  });

  test("cabang hanya melihat pesan ke gudang dan data siswa", () => {
    expect(getVisibleTabsForRole("branch_admin")).toEqual(["internal_orders", "students"]);
    expect(getVisibleTabsForRole("school_admin")).toEqual(["internal_orders", "students"]);
  });

  test("admin gudang terpisah per unit", () => {
    expect(getVisibleTabsForRole("warehouse_uniforms_admin")).toEqual(["uniforms"]);
    expect(getVisibleTabsForRole("warehouse_admin")).toEqual([
      "dashboard",
      "internal_orders",
      "students",
      "uniforms",
      "student_orders",
      "packages",
      "procurement",
      "returns",
      "inventory",
      "catalog",
      "reconciliation",
      "reports",
    ]);
    expect(getVisibleTabsForRole("warehouse_books_admin")).toEqual([
      "internal_orders",
      "students",
      "student_orders",
      "packages",
      "procurement",
      "returns",
      "inventory",
      "catalog",
      "reconciliation",
      "reports",
    ]);
  });
});
