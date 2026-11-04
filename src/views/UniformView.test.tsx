import "../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { UniformView } from "./UniformView";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("UniformView", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  const dummySchool = { id: "sch-1", name: "Sekolah Satu", code: "SCH1", type: "branch" as const };

  it("renders separated sub-tabs for logistics roles (katalog, packages, procurement)", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformView
          schools={[dummySchool]}
          activeSchool={null}
          userRole="warehouse_admin"
          userSchoolId={null}
        />
      );
    });

    expect(screen.getByRole("button", { name: /Pengiriman Seragam/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Katalog Seragam/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Paket & Rakit Seragam/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /PO Konveksi/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Tukar & Refund/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Laporan & Rekap/i })).toBeDefined();
  });

  it("hides logistics sub-tabs for school staff role", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformView
          schools={[dummySchool]}
          activeSchool={dummySchool}
          userRole="school_admin"
          userSchoolId="sch-1"
        />
      );
    });

    expect(screen.getByRole("button", { name: /Pengiriman Seragam/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Katalog Seragam/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Paket & Rakit Seragam/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /PO Konveksi/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Tukar & Refund/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Laporan & Rekap/i })).toBeDefined();
  });

  it("switches view when clicking sub-tab", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/procurement/suppliers")) {
        return new Response(JSON.stringify([{ id: "sup-1", name: "Konveksi Jaya" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <UniformView
          schools={[dummySchool]}
          activeSchool={null}
          userRole="warehouse_admin"
          userSchoolId={null}
        />
      );
    });

    const poTab = screen.getByRole("button", { name: /PO Konveksi/i });
    await act(async () => {
      fireEvent.click(poTab);
    });

    expect(screen.getByText(/PO ke Konveksi/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Buat PO/i })).toBeDefined();

    const packagesTab = screen.getByRole("button", { name: /Paket & Rakit Seragam/i });
    await act(async () => {
      fireEvent.click(packagesTab);
    });

    expect(screen.getByText(/Tambah Paket & Rakit Paket Seragam/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Simpan Definisi Paket/i })).toBeDefined();

    const catalogTab = screen.getByRole("button", { name: /Katalog Seragam/i });
    await act(async () => {
      fireEvent.click(catalogTab);
    });

    expect(screen.getByText(/Tambah Varian/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Simpan Varian/i })).toBeDefined();
  });
});
