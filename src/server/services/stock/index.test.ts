import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("stock seam", () => {
  it("satu seam: predikat + kernel + alokasi + ringkasan + dispose", () => {
    for (const fn of [
      "isAvailableLoose",
      "isReadyBundle",
      "outstandingOf",
      "tallyLooseByKey",
      "tallyPackagesByKey",
      "allocateInventoryStock",
      "getLooseStockSummary",
      "getPackageStockSummary",
      "planVendorReturnDispose",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
  });
});
