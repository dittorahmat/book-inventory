import "../../test-dom";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { CreateBookForm } from "./CreateBookForm";
import type { NewBookPayload } from "./catalog-intent";

const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");

describe("CreateBookForm", () => {
  afterEach(cleanup);

  test("mengizinkan submit form saat ISBN dikosongkan (opsional)", async () => {
    let capturedPayload: NewBookPayload | null = null;
    let capturedCover: File | null = "not-called" as unknown as File | null;

    const mockCreate = mock(async (payload: NewBookPayload, cover: File | null) => {
      capturedPayload = payload;
      capturedCover = cover;
    });

    render(<CreateBookForm onClose={() => {}} onCreate={mockCreate} />);

    // Isi field wajib: Judul, Penulis, Penerbit
    fireEvent.change(screen.getByPlaceholderText("Judul lengkap buku"), {
      target: { value: "Buku Panduan Guru SD" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nama penulis"), {
      target: { value: "Tim Penulis" },
    });
    fireEvent.change(screen.getByPlaceholderText("Penerbit"), {
      target: { value: "Penerbit Edukasi" },
    });

    // Pastikan input ISBN tidak memiliki atribut required
    const isbnInput = screen.getByPlaceholderText("Contoh: 978-3-16-148410-0 atau kode internal (kosongkan jika otomatis)");
    expect(isbnInput.hasAttribute("required")).toBe(false);

    // Submit form tanpa mengisi ISBN
    const submitBtn = screen.getByRole("button", { name: /Simpan Buku/i });
    fireEvent.click(submitBtn);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(capturedPayload as NewBookPayload | null).not.toBeNull();
    const result = capturedPayload as unknown as NewBookPayload;
    expect(result.isbn).toBe("");
    expect(result.title).toBe("Buku Panduan Guru SD");
    expect(capturedCover).toBeNull();
  });
});
