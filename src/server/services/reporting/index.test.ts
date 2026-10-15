import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("reporting seam", () => {
  it("satu seam: rekap buku + dasbor (seragam milik modul uniform)", () => {
    for (const fn of ["getSalesReport", "salesReportToCsv", "getDashboardSummary"]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
    expect(typeof seam.DashboardHttpError).toBe("function");
  });
});
