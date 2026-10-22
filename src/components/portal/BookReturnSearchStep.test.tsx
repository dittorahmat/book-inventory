import "../../test-dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
import type { FormEvent } from "react";
// Dinamis + top-level await: shim DOM harus terpasang sebelum testing-library mengikat document.
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { BookReturnSearchStep } from "./BookReturnSearchStep";
import type { PortalOrderLookup, SchoolOption } from "../../lib/portal-types";

afterEach(() => {
  cleanup();
});

const schools: SchoolOption[] = [{ id: "school-rf-ui", name: "Sekolah Refund UI", code: "RF-UI" }];

const noopSubmit = (_e: FormEvent): void => {
  void _e;
};

const order = (overrides: Partial<PortalOrderLookup>): PortalOrderLookup => ({
  id: "ord-rf-ui",
  orderNumber: "ORD-202610-0007",
  studentId: "st-rf-ui",
  studentName: "Ananda Refund",
  nis: "20241001",
  schoolId: "school-rf-ui",
  schoolName: "Sekolah Refund UI",
  packageId: "pkg-rf-ui",
  packageName: "Paket Kelas 4",
  fulfillmentStatus: "picked_up",
  paymentStatus: "paid",
  handoverDate: "2026-10-20T00:00:00.000Z",
  handoverDeliveryNumber: "SJ-SERAH-001",
  handoverRecipient: "Ortu Refund",
  ...overrides,
});

const renderStep = (props: Partial<Parameters<typeof BookReturnSearchStep>[0]> = {}) =>
  render(
    <BookReturnSearchStep
      schools={schools}
      schoolId="school-rf-ui"
      setSchoolId={() => {}}
      query="20241001"
      setQuery={() => {}}
      searching={false}
      searched
      orders={[]}
      error={null}
      onSearch={noopSubmit}
      onSelectOrder={() => {}}
      {...props}
    />
  );

describe("BookReturnSearchStep", () => {
  it("menampilkan empty state saat pencarian tidak menemukan pesanan", () => {
    renderStep();
    expect(screen.getByText("Pesanan tidak ditemukan")).toBeTruthy();
  });

  it("menampilkan galat server apa adanya", () => {
    renderStep({ error: "Cabang wajib dipilih" });
    expect(screen.getByRole("alert").textContent).toContain("Cabang wajib dipilih");
  });

  it("hanya pesanan yang sudah diserahkan yang bisa diajukan refund", () => {
    const onSelect = vi.fn();
    renderStep({
      orders: [
        order({ id: "ord-kirim", orderNumber: "ORD-KIRIM", fulfillmentStatus: "ready_for_pickup" }),
        order({ id: "ord-terima", orderNumber: "ORD-TERIMA" }),
      ],
      onSelectOrder: onSelect,
    });

    const buttons = screen.getAllByRole("button", { name: /ajukan refund/i }) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    const readyButton = buttons.find((b) => b.closest("div")?.textContent?.includes("ORD-KIRIM"))!;
    const pickedButton = buttons.find((b) => b.closest("div")?.textContent?.includes("ORD-TERIMA"))!;
    expect(readyButton.disabled).toBe(true);
    expect(pickedButton.disabled).toBe(false);
    expect(pickedButton.getAttribute("title")).toBeNull();
    expect(readyButton.getAttribute("title")).toContain("belum diserahkan");

    fireEvent.click(pickedButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect((onSelect.mock.calls[0][0] as PortalOrderLookup).id).toBe("ord-terima");
  });

  it("menjelaskan pesanan yang refund-nya sudah berjalan", () => {
    renderStep({ orders: [order({ fulfillmentStatus: "return_in_progress" })] });
    expect(screen.getByText("Refund sedang diproses")).toBeTruthy();
    const button = screen.getByRole("button", { name: /ajukan refund/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("title")).toContain("sudah dikirim");
  });
});
