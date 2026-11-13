import { describe, expect, it } from "bun:test";
import { generateBackfillRombelUpdates } from "./backfill-student-rombel-alw1";

describe("generateBackfillRombelUpdates", () => {
  it("menghasilkan pernyataan UPDATE dengan format ruang kelas berjenjang", () => {
    const csv = [
      "nis,nama,kelas,jk",
      "262710001,Abizar,1.INTER 1,Male",
      "252620002,Budi,2.MQ 2,Male",
      "242530003,Citra,Cuti,Female",
    ].join("\n");

    const updates = generateBackfillRombelUpdates(Buffer.from(csv), "2026-11-13T00:00:00.000Z");

    expect(updates.length).toBe(2);
    expect(updates[0]).toContain("rombel = '1 INTER 1'");
    expect(updates[0]).toContain("lower(nis) = '262710001'");
    expect(updates[1]).toContain("rombel = '2 MQ 2'");
    expect(updates[1]).toContain("lower(nis) = '252620002'");
  });
});
