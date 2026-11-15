import { describe, expect, it } from "bun:test";
import { parseBulkResiText } from "./bulk-resi";

describe("Bulk Resi parser and validator", () => {
  it("parses pipe-separated format: NIS | NAMA | Resi", () => {
    const text = `
NIS | NAMA | Resi
12345 | Ahmad Dahlan | JNE123456789
12346 | Siti Fatimah | JNT987654321
`;
    const rows = parseBulkResiText(text);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({
      nis: "12345",
      name: "Ahmad Dahlan",
      resi: "JNE123456789",
    });
    expect(rows[1]).toEqual({
      nis: "12346",
      name: "Siti Fatimah",
      resi: "JNT987654321",
    });
  });

  it("parses comma-separated format (CSV): NIS, NAMA, Resi", () => {
    const text = `
12345, Ahmad Dahlan, JNE123456789
12346, Siti Fatimah, JNT987654321
`;
    const rows = parseBulkResiText(text);
    expect(rows.length).toBe(2);
    expect(rows[0].nis).toBe("12345");
    expect(rows[0].resi).toBe("JNE123456789");
  });

  it("skips empty lines and header rows", () => {
    const text = `
nis | nama siswa | nomor resi
12345 | Ahmad Dahlan | JNE123456789

`;
    const rows = parseBulkResiText(text);
    expect(rows.length).toBe(1);
    expect(rows[0].nis).toBe("12345");
  });
});
