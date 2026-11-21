import "../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { PaymentConfirmView } from "./PaymentConfirmView";

afterEach(() => {
  cleanup();
});

describe("PaymentConfirmView", () => {
  it("renders invoice info and validates mandatory transferDate before submitting", async () => {
    // Mock fetch for get invoice data
    const originalFetch = globalThis.fetch;
    let postPayload: { transferDate?: string; transferAmount?: number } | null = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/public/orders/confirm/test-token")) {
        if (init?.method === "POST") {
          postPayload = JSON.parse(String(init.body));
          return new Response(JSON.stringify({ success: true, message: "OK", data: {} }), { status: 201 });
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              studentName: "Ahmad Test",
              orderNumber: "ORD-TEST-001",
              totalAmount: 500000,
              shippingCost: 0,
              due: 500000,
              paidAmount: 0,
              paymentStatus: "unpaid",
            },
          }),
          { status: 200 }
        );
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      render(<PaymentConfirmView kind="buku" token="test-token" />);

      // Tunggu invoice data ter-render
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.getByText("ORD-TEST-001")).toBeDefined();

      // Isi nominal transfer dan alokasi
      const transferInput = screen.getByPlaceholderText("Sesuai struk");
      fireEvent.change(transferInput, { target: { value: "500000" } });

      const allocationInput = screen.getByPlaceholderText("Bisa bertahap/cicilan");
      fireEvent.change(allocationInput, { target: { value: "500000" } });

      // Kosongkan tanggal transfer
      const dateInput = screen.getByLabelText(/Tanggal Transfer/i);
      fireEvent.change(dateInput, { target: { value: "" } });

      const submitBtn = screen.getByRole("button", { name: /Kirim Konfirmasi/i });
      fireEvent.click(submitBtn);

      // Verifikasi penolakan sebelum network request
      expect(postPayload).toBeNull();
      expect(screen.getByText(/Tanggal Transfer Bank wajib diisi/i)).toBeDefined();

      // Isi tanggal transfer yang valid
      fireEvent.change(dateInput, { target: { value: "2026-11-21" } });
      fireEvent.click(submitBtn);

      await new Promise((r) => setTimeout(r, 50));
      const payload = postPayload as { transferDate?: string; transferAmount?: number } | null;
      expect(payload).not.toBeNull();
      expect(payload?.transferDate).toBe("2026-11-21");
      expect(payload?.transferAmount).toBe(500000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
