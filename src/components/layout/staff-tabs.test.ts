import { describe, expect, test } from "bun:test";
import { DESKTOP_TABS, TAB_IDS, getVisibleTabsForRole } from "./staff-tabs";

describe("staff-tabs", () => {
  test("urutan render tab staf terkunci", () => {
    expect(DESKTOP_TABS.map((tab) => tab.id)).toEqual([
      "dashboard",
      "book_warehouse",
      "students",
      "uniforms",
      "student_orders",
      "internal_orders",
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

  test("central admin melihat tab utama ringkas", () => {
    expect(getVisibleTabsForRole("central_admin")).toEqual([
      "dashboard",
      "book_warehouse",
      "students",
      "uniforms",
      "student_orders",
      "reports",
      "settings",
    ]);
  });

  test("cabang melihat pesan ke gudang, data siswa, dan pesanan siswa", () => {
    expect(getVisibleTabsForRole("branch_admin")).toEqual(["students", "student_orders", "internal_orders"]);
    expect(getVisibleTabsForRole("school_admin")).toEqual(["students", "student_orders", "internal_orders"]);
    expect(getVisibleTabsForRole("branch_finance")).toEqual(["student_orders", "reports"]);
    const internalTab = DESKTOP_TABS.find((t) => t.id === "internal_orders");
    expect(internalTab?.label("branch_admin")).toBe("Terima Paket Dari Gudang");
  });

  test("admin gudang terpisah per unit", () => {
    expect(getVisibleTabsForRole("warehouse_uniforms_admin")).toEqual(["uniforms"]);
    expect(getVisibleTabsForRole("warehouse_admin")).toEqual([
      "dashboard",
      "book_warehouse",
      "students",
      "uniforms",
      "student_orders",
      "reports",
    ]);
    expect(getVisibleTabsForRole("warehouse_books_admin")).toEqual([
      "book_warehouse",
      "students",
      "student_orders",
      "reports",
    ]);
  });
});
