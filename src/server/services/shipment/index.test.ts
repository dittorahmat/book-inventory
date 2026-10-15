import { describe, expect, it } from "bun:test";
import * as seam from "./index";

describe("shipment seam", () => {
  it("satu seam: tulis + baca + rencana internal", () => {
    for (const fn of [
      "createShipment",
      "dispatchShipment",
      "receiveShipment",
      "rollbackShipment",
      "listShipmentsWithCounts",
      "getShipmentDetail",
      "planCreateLines",
    ]) {
      expect(typeof (seam as Record<string, unknown>)[fn], fn).toBe("function");
    }
  });
});
