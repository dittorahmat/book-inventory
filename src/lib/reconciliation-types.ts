/** Bentuk data rekonsiliasi & tagihan cabang yang dipakai UI (cermin respons API). */

export interface ReconciliationResult {
  period: string;
  moneyIn: { receiptCount: number; amount: number };
  allocations: { buku: number; seragam: number; total: number };
  unallocated: { receiptCount: number; amount: number };
  charges: {
    open: { count: number; goodsAmount: number };
    final: { count: number; goodsAmount: number; shippingAmount: number };
  };
  unbilled: { count: number; amount: number };
  claims: { count: number; totalAmount: number; goodsAmount: number; shippingAmount: number };
  difference: number;
}

export interface BranchChargeRow {
  id: string;
  chargeNumber: string;
  schoolId: string;
  sourceType: "book_order" | "uniform_order";
  sourceId: string;
  triggerEvent: "handover" | "order_created";
  chargeableAt: string;
  finalizedAt: string | null;
  goodsAmount: number;
  shippingAmount: number;
  status: "open" | "final";
}
