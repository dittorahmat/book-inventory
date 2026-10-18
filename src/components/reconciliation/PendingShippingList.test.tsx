import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { PendingShippingList } from "./PendingShippingList";
import type { BranchChargeRow } from "../../lib/reconciliation-types";

afterEach(() => cleanup());

const charge: BranchChargeRow = {
  id: "chg-1",
  chargeNumber: "TGH-20261012-AB12CD",
  schoolId: "school-1",
  sourceType: "uniform_order",
  sourceId: "uo-1",
  triggerEvent: "order_created",
  chargeableAt: "2026-10-12T03:00:00.000Z",
  finalizedAt: null,
  goodsAmount: 750000,
  shippingAmount: 0,
  status: "open",
};

describe("PendingShippingList", () => {
  it("menampilkan tagihan menunggu ongkir beserta nilai barangnya", () => {
    render(<PendingShippingList charges={[charge]} />);
    expect(screen.getByText("Menunggu ongkir (1)")).toBeDefined();
    expect(screen.getByText("TGH-20261012-AB12CD")).toBeDefined();
    expect(screen.getByText(/Pesanan seragam/)).toBeDefined();
    expect(screen.getByText("Rp 750.000")).toBeDefined();
  });

  it("empty state edukatif saat semua tagihan sudah final", () => {
    render(<PendingShippingList charges={[]} />);
    expect(screen.getByText("Tidak ada tagihan menunggu ongkir")).toBeDefined();
    expect(screen.getByText(/Semua tagihan sudah final/)).toBeDefined();
  });
});
