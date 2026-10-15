import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("order-intake seam", () => {
  it("satu seam mengekspor tiga interface dalam: publik, direct, kirim-satuan", () => {
    for (const fn of [
      "submitPublicOrder",
      "sellDirect",
      "markSatuanShipped",
      "resolveLooseLines",
      "reserveLooseLines",
      "getSatuanStatus",
      "getSatuanCatalogIfOpen",
      "getCurrentSatuanStatus",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
  });
});
