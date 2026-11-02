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
});
