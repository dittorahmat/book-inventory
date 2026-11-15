import { describe, expect, it } from "bun:test";
import {
  formatStructuredHomeAddress,
  type StructuredAddressInput,
} from "./structured-address";

describe("Structured address formatting and parsing", () => {
  it("formats structured address fields deterministically into a snapshot string", () => {
    const input: StructuredAddressInput = {
      recipientName: "Budi Santoso",
      recipientPhone: "081234567890",
      street: "Jl. Mawar Indah",
      rt: "03",
      rw: "05",
      houseNumber: "12A",
      kelurahan: "Baktijaya",
      kecamatan: "Sukmajaya",
      city: "Depok",
    };

    const formatted = formatStructuredHomeAddress(input);
    expect(formatted).toBe(
      "Budi Santoso (081234567890) - Jl. Mawar Indah No. 12A, RT 03/RW 05, Kel. Baktijaya, Kec. Sukmajaya, Depok"
    );
  });

  it("handles formatting with postal code", () => {
    const input: StructuredAddressInput = {
      recipientName: "Siti Aminah",
      recipientPhone: "081987654321",
      street: "Jl. Melati",
      rt: "01",
      rw: "02",
      houseNumber: "5",
      kelurahan: "Rawamangun",
      kecamatan: "Pulogadung",
      city: "Jakarta Timur",
      postalCode: "13220",
    };

    const formatted = formatStructuredHomeAddress(input);
    expect(formatted).toBe(
      "Siti Aminah (081987654321) - Jl. Melati No. 5, RT 01/RW 02, Kel. Rawamangun, Kec. Pulogadung, Jakarta Timur 13220"
    );
  });
});
