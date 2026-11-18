import { describe, expect, it } from "bun:test";
import {
  isKhimarSdVariant,
  KHIMAR_SD_SIZES,
  formatKhimarSdSizeLabel,
  getDefaultKhimarSdSize,
} from "./khimar-sd";

describe("Khimar SD sizing and predicates", () => {
  it("identifies Khimar SD variants by name or code and jenjang", () => {
    expect(
      isKhimarSdVariant({
        code: "UNI-SD-AKH-KHIMAR_HIJAU",
        name: "KHIMAR HIJAU (SD Akhwat)",
        jenjang: "sd",
      })
    ).toBe(true);

    expect(
      isKhimarSdVariant({
        code: "UNI-SD-AKH-KHIMAR_MERAH",
        name: "KHIMAR MERAH (SD Akhwat)",
        jenjang: "sd",
      })
    ).toBe(true);

    expect(
      isKhimarSdVariant({
        code: "KHIMAR-01",
        name: "Khimar Merah Polos",
        jenjang: "sd",
      })
    ).toBe(true);
  });

  it("does not treat TK, SMP, or SMA khimar as Khimar SD", () => {
    expect(
      isKhimarSdVariant({
        code: "UNI-TK-AKH-KHIMAR_HIJAU",
        name: "KHIMAR HIJAU (TK Akhwat)",
        jenjang: "tk",
      })
    ).toBe(false);

    expect(
      isKhimarSdVariant({
        code: "UNI-SMP-AKH-KHIMAR_HIJAU",
        name: "KHIMAR HIJAU (SMP Akhwat)",
        jenjang: "smp",
      })
    ).toBe(false);

    expect(
      isKhimarSdVariant({
        code: "UNI-SMA-AKH-KHIMAR_HIJAU",
        name: "KHIMAR HIJAU (SMA Akhwat)",
        jenjang: "sma",
      })
    ).toBe(false);
  });

  it("does not treat other SD garments as Khimar SD", () => {
    expect(
      isKhimarSdVariant({
        code: "UNI-SD-AKH-GAMIS_HIJAU",
        name: "GAMIS HIJAU (SD Akhwat)",
        jenjang: "sd",
      })
    ).toBe(false);
  });

  it("provides correct sizes and labels for Khimar SD", () => {
    expect(KHIMAR_SD_SIZES).toEqual(["1", "4"]);
    expect(formatKhimarSdSizeLabel("1")).toBe("Size 1 (Kelas 1 - 2)");
    expect(formatKhimarSdSizeLabel("4")).toBe("Size 4 (Kelas 3 - 6)");
    expect(formatKhimarSdSizeLabel("other")).toBe("other");
  });

  it("determines default Khimar SD size based on student grade level (ADR-0024)", () => {
    // Kelas 1-2 -> Size 1
    expect(getDefaultKhimarSdSize("1")).toBe("1");
    expect(getDefaultKhimarSdSize(1)).toBe("1");
    expect(getDefaultKhimarSdSize("2")).toBe("1");
    expect(getDefaultKhimarSdSize(2)).toBe("1");
    expect(getDefaultKhimarSdSize("SD 1")).toBe("1");
    expect(getDefaultKhimarSdSize("Kelas 2")).toBe("1");
    expect(getDefaultKhimarSdSize("1.INTER 1")).toBe("1");

    // Kelas 3-6 -> Size 4
    expect(getDefaultKhimarSdSize("3")).toBe("4");
    expect(getDefaultKhimarSdSize(3)).toBe("4");
    expect(getDefaultKhimarSdSize("4")).toBe("4");
    expect(getDefaultKhimarSdSize("5")).toBe("4");
    expect(getDefaultKhimarSdSize("6")).toBe("4");
    expect(getDefaultKhimarSdSize(6)).toBe("4");
    expect(getDefaultKhimarSdSize("SD 4")).toBe("4");
    expect(getDefaultKhimarSdSize("Kelas 6")).toBe("4");
    expect(getDefaultKhimarSdSize("3.MQ 2")).toBe("4");

    // Kelas lain / null
    expect(getDefaultKhimarSdSize("7")).toBeNull();
    expect(getDefaultKhimarSdSize("TK")).toBeNull();
    expect(getDefaultKhimarSdSize(null)).toBeNull();
    expect(getDefaultKhimarSdSize(undefined)).toBeNull();
  });
});
