import "../../test-dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
// Dinamis + top-level await: shim DOM harus terpasang sebelum testing-library mengikat document.
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { PortalTabs } from "./PortalTabs";
import { PUBLIC_TABS } from "./portal-tabs";

afterEach(() => {
  cleanup();
});

describe("PortalTabs", () => {
  it("merender seluruh tab portal publik dalam urutan kanonik", () => {
    render(<PortalTabs activeTab="order" onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    // Daftar literal (bukan PUBLIC_TABS) supaya penambahan/penghapusan tab
    // memaksa perubahan test ini — itulah gunanya gate.
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      "Formulir Pesan Buku",
      "Pesan Seragam",
      "Retur Seragam",
      "Refund Buku",
    ]);
    expect(PUBLIC_TABS.map((tab) => tab.id)).toEqual([
      "order",
      "uniform",
      "uniform_return",
      "book_return",
    ]);
  });

  it("menandai tab aktif dan meneruskan pilihan ke pemanggil", () => {
    const onSelect = vi.fn();
    render(<PortalTabs activeTab="book_return" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: /refund buku/i }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /formulir pesan buku/i }).getAttribute("aria-current")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /retur seragam/i }));
    expect(onSelect).toHaveBeenCalledWith("uniform_return");
  });

  it("tidak merender tombol bersarang (satu tombol per tab)", () => {
    render(<PortalTabs activeTab="order" onSelect={() => {}} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.querySelector("button")).toBeNull();
    }
  });
});
