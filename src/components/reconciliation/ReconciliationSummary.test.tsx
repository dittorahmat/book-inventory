import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
// Dinamis + top-level await: shim DOM harus terpasang sebelum @testing-library mengikat document.
const { cleanup, render, screen } = await import("@testing-library/react");
import { ReconciliationSummary } from "./ReconciliationSummary";
import type { KindSplit, ReconciliationResult } from "../../lib/reconciliation-types";

afterEach(() => cleanup());

const split = (
  buku: { count: number; goodsAmount: number; shippingAmount: number },
  seragam: { count: number; goodsAmount: number; shippingAmount: number }
): KindSplit => ({ buku, seragam });

const data: ReconciliationResult = {
  period: "2026-10",
  moneyIn: { receiptCount: 1, amount: 10000000 },
  allocations: { buku: 1000000, seragam: 500000, total: 1500000 },
  unallocated: { receiptCount: 1, amount: 8500000 },
  charges: {
    open: {
      count: 2,
      goodsAmount: 400000,
      byKind: split(
        { count: 1, goodsAmount: 250000, shippingAmount: 0 },
        { count: 1, goodsAmount: 150000, shippingAmount: 0 }
      ),
    },
    final: {
      count: 3,
      goodsAmount: 1500000,
      shippingAmount: 45000,
      byKind: split(
        { count: 2, goodsAmount: 1000000, shippingAmount: 30000 },
        { count: 1, goodsAmount: 500000, shippingAmount: 15000 }
      ),
    },
  },
  unbilled: { count: 1, amount: 775000 },
  claims: {
    count: 1,
    totalAmount: 1545000,
    goodsAmount: 1500000,
    shippingAmount: 45000,
    byKind: split(
      { count: 2, goodsAmount: 1000000, shippingAmount: 30000 },
      { count: 1, goodsAmount: 500000, shippingAmount: 15000 }
    ),
    lockedDrift: { count: 0, amount: 0 },
  },
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
    // Buku dan seragam bersebelahan, tanpa perlu laporan kedua.
    expect(screen.getAllByText("Buku Rp 1.030.000 · Seragam Rp 515.000").length).toBeGreaterThan(0);
    expect(screen.getByText("2 tagihan buku · 1 tagihan seragam")).toBeDefined();
    expect(screen.getByText("Ongkir buku Rp 30.000 · Ongkir seragam Rp 15.000")).toBeDefined();
    // Baris "tagihan final" dan "klaim" sama-sama memecah barang vs ongkir.
    expect(screen.getAllByText("Barang Rp 1.500.000 · Ongkir Rp 45.000")).toHaveLength(2);
    expect(screen.getByText("Rp 8.455.000")).toBeDefined();
  });

  it("memperingatkan klaim terkunci yang berubah setelah dikunci", () => {
    render(
      <ReconciliationSummary
        data={{ ...data, claims: { ...data.claims, lockedDrift: { count: 2, amount: 125000 } } }}
      />
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/2 klaim terkunci berubah setelah dikunci/)).toBeDefined();
    expect(screen.getByText(/Rp 125\.000 perlu diselesaikan di periode berikutnya/)).toBeDefined();
  });
});
