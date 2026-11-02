import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { useStudentOrders } from "./useStudentOrders";

const { renderHook, act, cleanup } = await import("@testing-library/react");

describe("useStudentOrders", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("fetches orders with schoolId when provided", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify({ success: true, data: [{ id: "ord-1", schoolId: "sch-1", studentName: "Ani" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { result } = renderHook(() => useStudentOrders("sch-1"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(requestedUrl).toContain("/api/student-orders?schoolId=sch-1");
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].studentName).toBe("Ani");
  });

  it("fetches orders without schoolId query when schoolId is omitted (multi-branch mode)", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify({ success: true, data: [{ id: "ord-all", schoolId: "sch-any", studentName: "Budi" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { result } = renderHook(() => useStudentOrders(null));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(requestedUrl).toBe("/api/student-orders");
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].studentName).toBe("Budi");
  });
});
