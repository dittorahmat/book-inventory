import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("return seam", () => {
  it("satu seam: mesin status + guard + perencana + penulis", () => {
    for (const fn of [
      "reportReturn",
      "resolveReturn",
      "planReturnResolve",
      "checkResolveTransition",
      "checkHandoverBundle",
      "checkReplacementLoose",
      "isOrderReportable",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
  });
});
