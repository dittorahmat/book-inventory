import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("purchase-order seam", () => {
  it("satu seam: alur draft→received + adapter surat", () => {
    for (const fn of [
      "createPurchaseOrder",
      "markPrinted",
      "uploadSignedDoc",
      "sendPo",
      "deletePurchaseOrder",
      "receivePurchaseOrder",
      "recordPoReceipt",
      "deliverPurchaseOrder",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
    expect(typeof seam.InMemoryPoMailSender).toBe("function");
  });
});
