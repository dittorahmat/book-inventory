import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("internal-po seam", () => {
  it("satu seam: PO + pemenuhan + penerimaan internal", () => {
    for (const fn of [
      "createInternalPo",
      "fulfillInternalPo",
      "listInternalPOs",
      "listInternalShipments",
      "receiveInternalShipment",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
  });
});
