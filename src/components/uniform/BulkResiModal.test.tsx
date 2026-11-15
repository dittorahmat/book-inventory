import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BulkResiModal } from "./BulkResiModal";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("BulkResiModal", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("renders input step with instructions and handles preview", async () => {
    let previewCalled = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/bulk-shipping-resi/preview")) {
        previewCalled = true;
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].nis).toBe("12345");
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  nis: "12345",
                  name: "Siswa A",
                  resi: "RESI001",
                  status: "valid",
                  orderNumber: "USO-001",
                  studentName: "Siswa A",
                },
              ],
              validCount: 1,
              errorCount: 0,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as typeof fetch;

    await act(async () => {
      render(
        <BulkResiModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          selectedSchoolId="sch-1"
          schoolName="Sekolah Depok"
        />
      );
    });

    expect(screen.getByText("Bulk Upload Resi Seragam")).toBeDefined();
    expect(screen.getByText("Cabang: Sekolah Depok")).toBeDefined();

    const textarea = screen.getByPlaceholderText("NIS | NAMA | Resi...");
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "12345 | Siswa A | RESI001" } });
    });

    const verifyBtn = screen.getByRole("button", { name: /Verifikasi & Preview/i });
    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(previewCalled).toBe(true);
    expect(screen.getByText("Valid / Siap Simpan")).toBeDefined();
    expect(screen.getByText("USO-001")).toBeDefined();
  });

  it("shows validation error if text is empty or invalid format", async () => {
    await act(async () => {
      render(
        <BulkResiModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );
    });

    const verifyBtn = screen.getByRole("button", { name: /Verifikasi & Preview/i });
    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    expect(screen.getByText(/Format teks tidak valid atau kosong/i)).toBeDefined();
  });
});
