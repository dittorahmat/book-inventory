import { describe, expect, it } from "bun:test";
import { planReturnResolve } from "./return-flow";

const base = {
  returnId: "ret-plan-1",
  defectiveBookId: "book-plan-1",
  order: { schoolId: "sch-plan-1", packageId: "pkg-plan-1" },
};

describe("planReturnResolve (T5)", () => {
  it("plans replace with dispose flip and picked_up when no sibling open", () => {
    const plan = planReturnResolve({ ...base, action: "replace", siblingOpen: false, replacementId: "bi-plan-9" });
    expect(plan.returnStatus).toBe("replaced");
    expect(plan.orderStatusAfter).toBe("picked_up");
    expect(plan.replacementBookItemId).toBe("bi-plan-9");
    expect(plan.disposeReplacementId).toBe("bi-plan-9");
    expect(plan.restoredStockRow).toBeNull();
    expect(plan.refundAmount).toBe(0);
  });

  it("keeps order in progress when a sibling report stays open", () => {
    const plan = planReturnResolve({ ...base, action: "replace", siblingOpen: true, replacementId: null });
    expect(plan.orderStatusAfter).toBe("return_in_progress");
    expect(plan.disposeReplacementId).toBeNull();
  });

  it("plans refund deterministically with an RFD restore row", () => {
    const plan = planReturnResolve(
      { ...base, action: "refund", siblingOpen: false, replacementId: null, refundAmount: 75000, handledByUserId: "u-1" },
      { now: "2026-10-10T00:00:00.000Z", generateId: () => "fixed-id-1234" }
    );
    expect(plan.returnStatus).toBe("refunded");
    expect(plan.refundAmount).toBe(75000);
    expect(plan.disposeReplacementId).toBeNull();
    expect(plan.restoredStockRow?.id).toBe("fixed-id-1234");
    expect(plan.restoredStockRow?.barcode.startsWith("RFD-")).toBe(true);
    expect(plan.restoredStockRow?.currentSchoolId).toBe("sch-plan-1");
    expect(plan.restoredStockRow?.condition).toBe("good");
  });

  it("plans reject with no side effects", () => {
    const plan = planReturnResolve({ ...base, action: "reject", siblingOpen: false, replacementId: null });
    expect(plan.returnStatus).toBe("rejected");
    expect(plan.orderStatusAfter).toBe("picked_up");
    expect(plan.replacementBookItemId).toBeNull();
    expect(plan.disposeReplacementId).toBeNull();
    expect(plan.restoredStockRow).toBeNull();
  });
});
