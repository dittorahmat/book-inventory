import { describe, expect, it } from "bun:test";
import { documentNumber, epochTimeFragment, isoTimeFragment } from "./document-number";

describe("isoTimeFragment", () => {
  it("equals the legacy inline expression for the same input", () => {
    const iso = "2026-10-17T12:34:56.789Z";
    expect(isoTimeFragment(iso, 8)).toBe(iso.replace(/\D/g, "").slice(-8));
    expect(isoTimeFragment(iso, 8)).toBe("23456789");
  });

  it("keeps exactly N trailing digits", () => {
    expect(isoTimeFragment("2026-10-17T12:34:56.789Z", 6)).toBe("456789");
    expect(isoTimeFragment("2026-10-17T12:34:56.789Z", 14)).toBe("61017123456789");
  });
});

describe("epochTimeFragment", () => {
  it("equals the legacy Date.now().toString().slice(-N) idiom", () => {
    const stamp = 1730000000005;
    expect(epochTimeFragment(stamp, 6)).toBe(stamp.toString().slice(-6));
    expect(epochTimeFragment(stamp, 6)).toBe("000005");
  });

  it("preserves leading zeros as a string (no numeric coercion)", () => {
    expect(epochTimeFragment(1000000000005, 4)).toBe("0005");
    expect(typeof epochTimeFragment(1000000000005, 4)).toBe("string");
  });
});

describe("documentNumber", () => {
  it("omits the serial when undefined", () => {
    expect(documentNumber("TRF", "123456")).toBe("TRF-123456");
  });

  it("appends a numeric serial", () => {
    expect(documentNumber("RTV", "123456", 789)).toBe("RTV-123456-789");
  });

  it("appends a string serial without dropping leading zeros", () => {
    expect(documentNumber("ORD", "123456", "0345")).toBe("ORD-123456-0345");
  });
});
