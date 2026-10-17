import { describe, expect, it } from "bun:test";
import { documentNumber, epochTimeFragment, isoTimeFragment, randomSerial } from "./document-number";

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

describe("randomSerial", () => {
  it("is zero-padded to the requested width (ruang 10^digits)", () => {
    for (let i = 0; i < 200; i++) expect(randomSerial(6)).toMatch(/^\d{6}$/);
  });

  it("defaults to 6 digits and honours a custom width", () => {
    expect(randomSerial()).toMatch(/^\d{6}$/);
    expect(randomSerial(3)).toMatch(/^\d{3}$/);
  });
});

describe("ruang fragmen waktu (regresi audit tabrakan Okt 2026)", () => {
  // Regresi: 6 digit epoch berulang tiap 10^6 ms, sehingga `TRF-<6 digit>` yang
  // sama terbit lagi 16 menit 40 detik kemudian dan menabrak UNIQUE
  // shipment_number. 8 digit memperbesar ruang ke 10^8 (berulang tiap ~27,8 jam).
  it("6 digit bertabrakan pada 10^6 ms; 8 digit tidak", () => {
    const t0 = Date.UTC(2026, 9, 17, 10, 0, 0, 0);
    expect(epochTimeFragment(t0, 6)).toBe(epochTimeFragment(t0 + 1_000_000, 6));
    expect(epochTimeFragment(t0, 8)).not.toBe(epochTimeFragment(t0 + 1_000_000, 8));
  });
});
