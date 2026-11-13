import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { UniformShipmentSection } from "./UniformShipmentSection";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("UniformShipmentSection", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("renders with 'Semua Cabang' option when not locked to a specific school", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformShipmentSection
          schools={[{ id: "sch-1", name: "Sekolah Satu" }]}
          lockedSchoolId={null}
        />
      );
    });

    const trigger = screen.getByRole("button", { name: "Sekolah" });
    expect(trigger).toBeDefined();

    await act(async () => {
      fireEvent.click(trigger);
    });

    expect(screen.getAllByText("🏢 Semua Cabang").length).toBeGreaterThan(0);
    expect(screen.getByText("Sekolah Satu")).toBeDefined();
  });

  it("does not render 'Semua Cabang' option when locked to a specific school", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformShipmentSection
          schools={[{ id: "sch-1", name: "Sekolah Satu" }]}
          lockedSchoolId="sch-1"
        />
      );
    });

    expect(screen.queryByText("🏢 Semua Cabang")).toBeNull();
    expect(screen.getByText("Sekolah Satu")).toBeDefined();
  });

  it("opens UniformShipModal when clicking Kirim Seragam on eligible order", async () => {
    const mockOrder = {
      id: "ord-test-1",
      orderNumber: "USO-TEST-001",
      studentId: "stu-1",
      studentName: "Ahmad Siswa",
      schoolId: "sch-1",
      schoolName: "Sekolah Satu",
      academicYear: "2026/2027",
      shipmentStatus: "belum_dikirim",
      paymentStatus: "paid",
      orderType: "regular",
      totalAmount: 250000,
      paidAmount: 250000,
      shippingResi: null,
      homeAddressSnapshot: "Jl. Mawar 123",
      createdAt: new Date().toISOString(),
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/uniforms/orders")) {
        return new Response(JSON.stringify({ success: true, data: [mockOrder] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformShipmentSection
          schools={[{ id: "sch-1", name: "Sekolah Satu" }]}
          lockedSchoolId="sch-1"
        />
      );
    });

    const shipButton = screen.getByRole("button", { name: /kirim seragam/i });
    expect(shipButton).toBeDefined();

    await act(async () => {
      fireEvent.click(shipButton);
    });

    // Modal pengiriman seragam muncul
    expect(screen.getByText(/konfirmasi pengiriman seragam/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/contoh: jne-990123/i)).toBeDefined();
  });

  it("blocks shipping when order is unpaid", async () => {
    const mockUnpaidOrder = {
      id: "ord-unpaid-1",
      orderNumber: "USO-UNPAID-001",
      studentId: "stu-2",
      studentName: "Budi Siswa",
      schoolId: "sch-1",
      schoolName: "Sekolah Satu",
      academicYear: "2026/2027",
      shipmentStatus: "belum_dikirim",
      paymentStatus: "unpaid",
      orderType: "regular",
      totalAmount: 250000,
      paidAmount: 0,
      shippingResi: null,
      homeAddressSnapshot: "Jl. Anggrek 456",
      createdAt: new Date().toISOString(),
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/uniforms/orders")) {
        return new Response(JSON.stringify({ success: true, data: [mockUnpaidOrder] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformShipmentSection
          schools={[{ id: "sch-1", name: "Sekolah Satu" }]}
          lockedSchoolId="sch-1"
        />
      );
    });

    const shipButton = screen.getByRole("button", { name: /kirim seragam/i });
    await act(async () => {
      fireEvent.click(shipButton);
    });

    // Muncul alert pesan error karena unpaid
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/belum layak kirim karena pembayaran masih unpaid/i)).toBeDefined();
  });
});
