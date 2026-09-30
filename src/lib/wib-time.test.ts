import { describe, expect, it } from "bun:test";
import {
  currentAcademicYear,
  isWIBOnOrAfter,
  toWIBDate,
  todayWIB,
  wibStartOfDay,
} from "./wib-time";

describe("Utilitas zona WIB (spec: public-order-satuan)", () => {
  it("menghitung tanggal WIB dari UTC: 31 Juli 18.00 UTC = 1 Agustus 01.00 WIB", () => {
    const utc = new Date("2026-07-31T18:00:00.000Z");
    expect(utc.toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(toWIBDate(utc)).toBe("2026-08-01");
    expect(todayWIB(utc)).toBe("2026-08-01");
  });

  it("menjaga tanggal WIB tetap sama pada batas tengah malam WIB", () => {
    // 2026-08-01 00:30 WIB = 2026-07-31 17:30 UTC
    expect(toWIBDate(new Date("2026-07-31T17:30:00.000Z"))).toBe("2026-08-01");
    // 2026-07-31 23:30 WIB = 2026-07-31 16:30 UTC
    expect(toWIBDate(new Date("2026-07-31T16:30:00.000Z"))).toBe("2026-07-31");
  });

  it("membandingkan tanggal efektif memakai WIB, bukan zona server", () => {
    // Server masih 31 Juli UTC, tetapi WIB sudah 1 Agustus -> terbuka.
    const today = toWIBDate(new Date("2026-07-31T18:00:00.000Z"));
    expect(today).toBe("2026-08-01");
    expect(isWIBOnOrAfter(today, "2026-08-01")).toBe(true);
    expect(isWIBOnOrAfter(today, "2026-08-02")).toBe(false);
  });

  it("wibStartOfDay mengembalikan epoch UTC tengah malam WIB", () => {
    const epoch = wibStartOfDay("2026-08-01");
    expect(new Date(epoch).toISOString()).toBe("2026-07-31T17:00:00.000Z");
  });

  it("menentukan tahun ajaran dengan rollover Agustus", () => {
    // 1 Agustus 2026 -> tahun ajaran 2026/2027
    expect(currentAcademicYear(new Date("2026-07-31T18:00:00.000Z"))).toBe("2026/2027");
    // 31 Juli 2026 -> masih tahun ajaran 2025/2026
    expect(currentAcademicYear(new Date("2026-07-31T16:00:00.000Z"))).toBe("2025/2026");
    // 1 Januari 2027 -> masih 2026/2027
    expect(currentAcademicYear(new Date("2026-12-31T17:00:00.000Z"))).toBe("2026/2027");
  });
});
