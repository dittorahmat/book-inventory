import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
import type { BookPackageOption } from "../../lib/portal-types";
import { useBookReturn } from "./useBookReturn";

const { renderHook, act, cleanup } = await import("@testing-library/react");

const dummyPackages: BookPackageOption[] = [];

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("useBookReturn hook API interaction", () => {
  it("forwards query and schoolId as an object to lookupReturnableOrders", async () => {
    let capturedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      if (capturedUrl.includes("/book-choices")) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "ord-test-1",
              orderNumber: "ORD-202609-001",
              studentId: "std-test-1",
              studentName: "Aisyah",
              nis: "2024101002",
              schoolId: "school-alw-1",
              schoolName: "Al Wildan 1",
              packageId: "pkg-1",
              packageName: "Paket 1",
              fulfillmentStatus: "picked_up",
              paymentStatus: "paid",
              handoverDate: "2026-09-01",
              handoverDeliveryNumber: "SJ-001",
              handoverRecipient: "Bambang",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const { result } = renderHook(() => useBookReturn(dummyPackages));

    act(() => {
      result.current.setSchoolId("school-alw-1");
      result.current.setQuery("Aisyah");
    });

    await act(async () => {
      await result.current.handleSearch({ preventDefault: () => {} } as React.FormEvent);
    });

    expect(capturedUrl).toContain("query=Aisyah");
    expect(capturedUrl).toContain("schoolId=school-alw-1");
    expect(capturedUrl).toBe("/api/public/orders/lookup-order?query=Aisyah&schoolId=school-alw-1");
    expect(result.current.orders.length).toBe(1);
    expect(result.current.orders[0].orderNumber).toBe("ORD-202609-001");
  });
});
