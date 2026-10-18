import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { SearchableSingleSelect } from "./SearchableSingleSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: "a", label: "Al Wildan Pusat", hint: "ALW-0" },
  { value: "b", label: "Cabang Bogor", hint: "ALW-1" },
  { value: "c", label: "Cabang Depok", hint: "ALW-2" },
];

describe("SearchableSingleSelect", () => {
  it("memfilter opsi lewat ketikan dan memanggil onChange saat dipilih", async () => {
    let picked = "";
    render(
      <SearchableSingleSelect
        label="Sekolah"
        options={OPTIONS}
        value={picked}
        onChange={(v) => {
          picked = v;
        }}
        placeholder="Pilih sekolah..."
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Sekolah" }));
    fireEvent.change(screen.getByPlaceholderText(/ketik untuk mencari/i), { target: { value: "bogor" } });
    expect(screen.queryByText("Al Wildan Pusat")).toBeNull();
    expect(screen.getByText("Cabang Bogor")).toBeDefined();
    fireEvent.click(screen.getByText("Cabang Bogor"));
    expect(picked).toBe("b");
  });

  it("menampilkan empty-state saat tidak ada yang cocok", async () => {
    render(
      <SearchableSingleSelect options={OPTIONS} value="" onChange={() => {}} placeholder="Pilih..." />
    );
    fireEvent.click(screen.getByRole("button", { name: /pilih/i }));
    fireEvent.change(screen.getByPlaceholderText(/ketik untuk mencari/i), { target: { value: "zzz-tidak-ada" } });
    expect(screen.getByText("Tidak ada hasil yang cocok.")).toBeDefined();
  });
});

describe("SearchableMultiSelect", () => {
  it("toggle checkbox menambah value dan chip menghapusnya", async () => {
    let values: string[] = [];
    const { rerender } = render(
      <SearchableMultiSelect options={OPTIONS} values={values} onChange={(v) => { values = v; }} placeholder="Pilih supplier..." />
    );
    fireEvent.click(screen.getByRole("button", { name: /pilih supplier/i }));
    fireEvent.click(screen.getByText("Cabang Bogor"));
    expect(values).toEqual(["b"]);
    rerender(
      <SearchableMultiSelect options={OPTIONS} values={values} onChange={(v) => { values = v; }} placeholder="Pilih supplier..." />
    );
    expect(screen.getByText(/1 dipilih/)).toBeDefined();
    fireEvent.click(screen.getByTitle("Hapus Cabang Bogor"));
    expect(values).toEqual([]);
  });
});
