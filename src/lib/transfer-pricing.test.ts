import { describe, expect, test } from "bun:test";
import {
  calcTransferLooseTotal,
  calcTransferPackageTotal,
  buildCreateShipmentPayload,
  buildReceiveShipmentPayload,
} from "./transfer-pricing";

describe("calcTransferLooseTotal (T7 optimistic total behind seam)", () => {
  test("sums effective sell price with legacy fallback", () => {
    const items = [
      { id: "i-1", book: { sellPrice: 50000, price: 0 } },
      { id: "i-2", book: { sellPrice: 0, price: 42000 } },
      { id: "i-3", book: { sellPrice: 30000, price: 99999 } },
    ];
    expect(calcTransferLooseTotal(["i-1", "i-2"], items)).toBe(50000 + 42000);
    expect(calcTransferLooseTotal(["i-3"], items)).toBe(30000);
  });

  test("ignores unknown ids and missing books as zero", () => {
    const items = [{ id: "i-1", book: { sellPrice: 10000 } }];
    expect(calcTransferLooseTotal(["nope"], items)).toBe(0);
    expect(calcTransferLooseTotal([], items)).toBe(0);
  });
});

describe("calcTransferPackageTotal (T7 optimistic total behind seam)", () => {
  test("sums bundle packagePrice for selected ids", () => {
    const bundles = [
      { id: "b-1", packagePrice: 900000 },
      { id: "b-2", packagePrice: 750000 },
    ];
    expect(calcTransferPackageTotal(["b-1", "b-2"], bundles)).toBe(1650000);
    expect(calcTransferPackageTotal(["b-2"], bundles)).toBe(750000);
  });

  test("unknown ids count as zero", () => {
    expect(calcTransferPackageTotal(["x"], [{ id: "b-1", packagePrice: 5 }])).toBe(0);
  });
});

describe("buildCreateShipmentPayload (T7 payload behind seam)", () => {
  test("trims reason and sets scheduled notes by default", () => {
    const p = buildCreateShipmentPayload({
      fromSchoolId: "s-1",
      toSchoolId: "s-2",
      bookItemIds: ["i-1"],
      packageItemIds: [],
      reason: "  pindah  ",
      instant: false,
    });
    expect(p.fromSchoolId).toBe("s-1");
    expect(p.reason).toBe("pindah");
    expect(p.notes).toBe("Scheduled distribution");
    expect(p.instant).toBe(false);
  });

  test("instant flag sets instant notes", () => {
    const p = buildCreateShipmentPayload({
      fromSchoolId: "s-1",
      toSchoolId: "s-2",
      bookItemIds: [],
      packageItemIds: ["b-1"],
      instant: true,
    });
    expect(p.notes).toBe("Instant stock transfer");
  });

  test("rejects empty selection with explicit message", () => {
    expect(() =>
      buildCreateShipmentPayload({ fromSchoolId: "s-1", toSchoolId: "s-2", bookItemIds: [], packageItemIds: [] })
    ).toThrow(/minimal 1 buku/);
  });
});

describe("buildReceiveShipmentPayload (T7 payload behind seam)", () => {
  const manifest = [
    { itemType: "loose", bookItemId: "i-1" },
    { itemType: "package", packageItemId: "b-1" },
  ];
  test("defaults missing picks to good", () => {
    const p = buildReceiveShipmentPayload(manifest, [], []);
    expect(p.itemReceipts).toEqual([{ bookItemId: "i-1", condition: "good" }]);
    expect(p.packageReceipts).toEqual([{ packageItemId: "b-1", condition: "good" }]);
  });

  test("honours explicit picks", () => {
    const p = buildReceiveShipmentPayload(
      manifest,
      [{ bookItemId: "i-1", condition: "damaged" }],
      [{ packageItemId: "b-1", condition: "missing" }]
    );
    expect(p.itemReceipts?.[0]?.condition).toBe("damaged");
    expect(p.packageReceipts?.[0]?.condition).toBe("missing");
  });

  test("empty manifest is rejected explicitly", () => {
    expect(() => buildReceiveShipmentPayload([], [], [])).toThrow(/tidak ada item manifest/i);
  });
});
