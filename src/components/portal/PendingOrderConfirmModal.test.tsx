import "../../test-dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { PendingOrderConfirmModal } from "./PendingOrderConfirmModal";
import type { PendingOrderSummary } from "./portal-api";

afterEach(() => {
  cleanup();
});

const sampleOrder: PendingOrderSummary = {
  id: "ord-test-1",
  orderNumber: "ORD-202611-001",
  orderType: "regular",
  totalAmount: 1500000,
  paidAmount: 1500000,
  paymentStatus: "paid",
  createdAt: "2026-11-01T00:00:00.000Z",
};

describe("PendingOrderConfirmModal", () => {
  it("renders pending order details for book", () => {
    const onReplace = vi.fn();
    const onKeep = vi.fn();
    const onCancel = vi.fn();

    render(
      <PendingOrderConfirmModal
        order={sampleOrder}
        kind="buku"
        onReplace={onReplace}
        onKeepAndAdd={onKeep}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("Pesanan Buku Gantung Terdeteksi")).toBeTruthy();
    expect(screen.getByText("ORD-202611-001")).toBeTruthy();

    const replaceBtn = screen.getByRole("button", { name: /ganti pesanan lama/i });
    const keepBtn = screen.getByRole("button", { name: /buat pesanan baru/i });
    expect(replaceBtn).toBeTruthy();
    expect(keepBtn).toBeTruthy();

    fireEvent.click(replaceBtn);
    expect(onReplace).toHaveBeenCalledTimes(1);

    fireEvent.click(keepBtn);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it("renders pending order details for uniform", () => {
    render(
      <PendingOrderConfirmModal
        order={sampleOrder}
        kind="seragam"
        onReplace={() => {}}
        onKeepAndAdd={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText("Pesanan Seragam Gantung Terdeteksi")).toBeTruthy();
  });
});
