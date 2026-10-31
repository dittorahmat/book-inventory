import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
import { useOrderDraft } from "./useOrderDraft";

const { renderHook, act, cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});

describe("useOrderDraft intents", () => {
  it("choosePaymentScheme menyetel skema dan nominal alokasi dalam satu transisi", () => {
    const { result } = renderHook(() => useOrderDraft(25000));

    act(() => result.current.actions.choosePaymentScheme({ choice: "partial", bookTotal: 900_000 }));
    expect(result.current.draft.paymentChoice).toBe("partial");
    expect(result.current.draft.bookAllocationAmount).toBe(450_000);

    act(() => result.current.actions.choosePaymentScheme({ choice: "full", bookTotal: 900_000 }));
    expect(result.current.draft.paymentChoice).toBe("full");
    expect(result.current.draft.bookAllocationAmount).toBe(900_000);
  });

  it("attachProof mengisi slot bukti yang diminta tanpa menyentuh slot lain", () => {
    const { result } = renderHook(() => useOrderDraft(0));

    act(() => result.current.actions.attachProof("payment", "data:image/png;base64,abc"));
    expect(result.current.draft.paymentProofBase64).toBe("data:image/png;base64,abc");
    expect(result.current.draft.scholarshipProofBase64).toBe("");
    expect(result.current.draft.financeProofBase64).toBe("");

    act(() => result.current.actions.attachProof("scholarship", "data:image/png;base64,sch"));
    expect(result.current.draft.scholarshipProofBase64).toBe("data:image/png;base64,sch");
    expect(result.current.draft.paymentProofBase64).toBe("data:image/png;base64,abc");
  });

  it("edit hanya menimpa field yang dikirim", () => {
    const { result } = renderHook(() => useOrderDraft(0));

    act(() => result.current.actions.edit({ bankName: "Mandiri", referenceNumber: "REF-9" }));
    expect(result.current.draft.bankName).toBe("Mandiri");
    expect(result.current.draft.referenceNumber).toBe("REF-9");
    expect(result.current.draft.orderType).toBe("regular");
    expect(result.current.draft.wprPrice).toBe(0);
  });
});
