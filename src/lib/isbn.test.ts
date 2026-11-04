import { describe, expect, test } from "bun:test";
import { generateFallbackIsbn, resolveBookIsbn } from "./isbn";

describe("book isbn helper", () => {
  test("generateFallbackIsbn menghasilkan format AUTO-[stamp]-[serial]", () => {
    const fixedTime = 1730600000000;
    const entropy = "1234abcd-5678-90ef";
    const res = generateFallbackIsbn(fixedTime, entropy);
    expect(res).toBe(`AUTO-${fixedTime.toString(36).toUpperCase()}-1234`);
  });

  test("resolveBookIsbn mempertahankan ISBN manual jika terisi", () => {
    expect(resolveBookIsbn("978-0132350884")).toBe("978-0132350884");
    expect(resolveBookIsbn("  3343242  ")).toBe("3343242");
  });

  test("resolveBookIsbn menghasilkan fallback otomatis jika kosong atau null", () => {
    expect(resolveBookIsbn("")).toMatch(/^AUTO-/);
    expect(resolveBookIsbn("   ")).toMatch(/^AUTO-/);
    expect(resolveBookIsbn(undefined)).toMatch(/^AUTO-/);
    expect(resolveBookIsbn(null)).toMatch(/^AUTO-/);
  });

  test("resolveBookIsbn menghasilkan kode internal berbasis judul dan kelas jika diberikan", () => {
    const code = resolveBookIsbn(undefined, undefined, undefined, "Akidah Akhlak 1", "1");
    expect(code).toBe("BK-SD1-AKIDAH-AKHLAK-1");

    const codeMath = resolveBookIsbn(null, undefined, undefined, "Prime Math 1A Coursebook", "1");
    expect(codeMath).toBe("BK-SD1-PRIME-MATH-1A-COURSEBOOK");
  });

});
