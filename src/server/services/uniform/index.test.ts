import { describe, expect, it } from "bun:test";
import * as seam from "./index";
import { KAIN_SIZE as catalogKain } from "./catalog";

describe("uniform seam", () => {
  it("satu seam mengekspor seluruh interface publik", () => {
    for (const fn of [
      "createUniformVariant", "listUniformVariants", "createUniformPackage", "listUniformPackages",
      "submitUniformOrder", "markUniformShipped",
      "requestUniformExchange", "resolveUniformExchange", "requestUniformRefund", "resolveUniformRefund",
      "listUniformExchanges", "listUniformRefunds",
      "createUniformPo", "receiveUniformPo", "assembleUniformPackages",
      "createUniformClaim", "lockUniformClaim", "listUniformClaims",
      "getUniformSalesReport",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
    expect(seam.KAIN_SIZE).toBe("—");
    expect(seam.KAIN_SIZE).toBe(catalogKain);
  });
});
