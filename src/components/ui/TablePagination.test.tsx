import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { TablePagination } from "./TablePagination";
import { paginateItems } from "./useTablePagination";

afterEach(() => {
  cleanup();
});

describe("TablePagination", () => {
  it("merender informasi rentang data dan nomor halaman dengan benar", () => {
    let pageChange = 0;
    render(
      <TablePagination
        page={2}
        limit={10}
        total={45}
        totalPages={5}
        onPageChange={(p) => {
          pageChange = p;
        }}
        itemName="siswa"
      />
    );

    // Rentang baris: (2 - 1)*10 + 1 = 11 s/d min(2*10, 45) = 20
    expect(screen.getByText(/Menampilkan baris/i)).toBeDefined();
    expect(screen.getByText("11 - 20")).toBeDefined();
    expect(screen.getByText(/dari total/i)).toBeDefined();
    expect(screen.getByText("45")).toBeDefined();
    expect(screen.getByText("2 / 5")).toBeDefined();

    // Navigasi
    const prevBtn = screen.getByRole("button", { name: /sebelumnya/i });
    const nextBtn = screen.getByRole("button", { name: /selanjutnya/i });

    expect(prevBtn.hasAttribute("disabled")).toBe(false);
    expect(nextBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(prevBtn);
    expect(pageChange).toBe(1);

    fireEvent.click(nextBtn);
    expect(pageChange).toBe(3);
  });

  it("men-disable tombol sebelumnya saat berada di halaman pertama", () => {
    let called = false;
    render(
      <TablePagination
        page={1}
        limit={10}
        total={25}
        totalPages={3}
        onPageChange={() => {
          called = true;
        }}
      />
    );

    const prevBtn = screen.getByRole("button", { name: /sebelumnya/i });
    const nextBtn = screen.getByRole("button", { name: /selanjutnya/i });

    expect(prevBtn.hasAttribute("disabled")).toBe(true);
    expect(nextBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(prevBtn);
    expect(called).toBe(false);
  });

  it("men-disable tombol selanjutnya saat berada di halaman terakhir", () => {
    let called = false;
    render(
      <TablePagination
        page={3}
        limit={10}
        total={25}
        totalPages={3}
        onPageChange={() => {
          called = true;
        }}
      />
    );

    const prevBtn = screen.getByRole("button", { name: /sebelumnya/i });
    const nextBtn = screen.getByRole("button", { name: /selanjutnya/i });

    expect(prevBtn.hasAttribute("disabled")).toBe(false);
    expect(nextBtn.hasAttribute("disabled")).toBe(true);

    fireEvent.click(nextBtn);
    expect(called).toBe(false);
  });

  it("tidak merender apa-apa jika totalPages <= 1 dan total <= limit kecuali showWhenSinglePage true", () => {
    const { container } = render(
      <TablePagination
        page={1}
        limit={10}
        total={5}
        totalPages={1}
        onPageChange={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("paginateItems", () => {
  const dummy = [1, 2, 3, 4, 5, 6, 7];

  it("memotong array sesuai page dan limit", () => {
    const p1 = paginateItems(dummy, 1, 3);
    expect(p1.items).toEqual([1, 2, 3]);
    expect(p1.totalPages).toBe(3);
    expect(p1.total).toBe(7);

    const p3 = paginateItems(dummy, 3, 3);
    expect(p3.items).toEqual([7]);
  });

  it("menangani halaman di luar batas", () => {
    const pOut = paginateItems(dummy, 5, 3);
    expect(pOut.items).toEqual([]);
    expect(pOut.totalPages).toBe(3);
  });
});
