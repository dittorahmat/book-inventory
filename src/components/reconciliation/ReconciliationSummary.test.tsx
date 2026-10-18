import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
// Dinamis + top-level await: shim DOM harus terpasang sebelum @testing-library mengikat document.
const { cleanup, render, screen } = await import("@testing-library/react");
import { ReconciliationSummary } from "./ReconciliationSummary";
import type { ReconciliationResult } from "../../lib/reconciliation-types";

afterEach(() => cleanup());

const data: ReconciliationResult = {
  period: "2026-10",
  moneyIn: { receiptCount: 1, amount: 10000000 },
  allocations: { buku: 1000000, seragam: 500000, total: 1500000 },
  unallocated: { receiptCount: 1, amount: 8500000 },
  charges: {
    open: { count: 2, goodsAmount: 400000 },
    final: { count: 3, goodsAmount: 1500000, shippingAmount: 45000 },
  },
  unbilled: { count: 1, amount: 775000 },
  claims: { count: 1, totalAmount: 1545000, goodsAmount: 1500000, shippingAmount: 45000 },
  difference: 8455000,
};

describe("ReconciliationSummary", () => {
  it("menampilkan uang masuk, saldo belum dialokasikan, ongkir terpisah, dan selisih", () => {
    render(<ReconciliationSummary data={data} />);

    expect(screen.getByText("Rekonsiliasi 2026-10")).toBeDefined();
    expect(screen.getByText("Rp 10.000.000")).toBeDefined();
    expect(screen.getByText("1 struk terverifikasi")).toBeDefined();
    expect(screen.getByText("Rp 8.500.000")).toBeDefined();
    expect(screen.getAllByText(/Ongkir Rp 45\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText("Rp 775.000")).toBeDefined();
    expect(screen.getByText("1 tagihan final belum ditagihkan ke cabang")).toBeDefined();
    // Baris "tagihan final" dan "klaim" sama-sama memecah barang vs ongkir.
    expect(screen.getAllByText("Barang Rp 1.500.000 · Ongkir Rp 45.000")).toHaveLength(2);
    expect(screen.getByText("Rp 8.455.000")).toBeDefined();
  });
});
