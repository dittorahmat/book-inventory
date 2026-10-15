import { describe, expect, it } from "bun:test";
import { planVendorReturnDispose } from "./vendor-return";

describe("planVendorReturnDispose", () => {
  it("picks only in_stock rows up to the requested quantity", () => {
    const ids = planVendorReturnDispose(
      [
        { id: "rtv-a1", status: "in_stock" },
        { id: "rtv-a2", status: "reserved" },
        { id: "rtv-a3", status: "in_stock" },
        { id: "rtv-a4", status: "in_stock" },
      ],
      2
    );
    expect(ids).toEqual(["rtv-a1", "rtv-a3"]);
  });

  it("returns empty when nothing is in_stock", () => {
    expect(
      planVendorReturnDispose(
        [
          { id: "rtv-b1", status: "disposed" },
          { id: "rtv-b2", status: "damaged" },
        ],
        2
      )
    ).toEqual([]);
  });
});
