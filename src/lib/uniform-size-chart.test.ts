import { describe, expect, it } from "bun:test";
import {
  getUniformSizeChart,
  normalizeUniformJenjang,
  formatUniformSizeLabel,
  getOfficialSportSizesForJenjang,
  TK_SIZE_CHART,
  SD_SIZE_CHART,
  SMP_SIZE_CHART,
  SMA_SIZE_CHART,
} from "./uniform-size-chart";

describe("uniform-size-chart", () => {
  it("normalizes jenjang strings accurately", () => {
    expect(normalizeUniformJenjang("tk")).toBe("tk");
    expect(normalizeUniformJenjang("SD")).toBe("sd");
    expect(normalizeUniformJenjang("SMP IT")).toBe("smp");
    expect(normalizeUniformJenjang("SMA Islam")).toBe("sma");
    expect(normalizeUniformJenjang(undefined)).toBe("sd");
  });

  it("retrieves official TK size chart (S to XL with matching cm)", () => {
    const tk = getUniformSizeChart("tk");
    expect(tk.map((e) => e.size)).toEqual(["S", "M", "L", "XL"]);
    expect(tk[0]).toEqual({ chartNumber: 4, size: "S", chestWidthCm: 36, bottomLengthCm: 57 });
  });

  it("retrieves official SD size chart (S to 4XL with matching cm)", () => {
    const sd = getUniformSizeChart("sd");
    expect(sd.map((e) => e.size)).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL"]);
    expect(sd.find((e) => e.size === "M")).toEqual({ chartNumber: 8, size: "M", chestWidthCm: 44, bottomLengthCm: 79 });
  });

  it("retrieves official SMP size chart (S to 5XL with matching cm)", () => {
    const smp = getUniformSizeChart("smp");
    expect(smp.map((e) => e.size)).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
    expect(smp.find((e) => e.size === "5XL")).toEqual({ chartNumber: 20, size: "5XL", chestWidthCm: 62, bottomLengthCm: 108 });
    expect(smp).toBe(SMP_SIZE_CHART);
  });

  it("retrieves official SMA size chart as an independent entity (S to 5XL with matching cm)", () => {
    const sma = getUniformSizeChart("sma");
    expect(sma.map((e) => e.size)).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
    expect(sma.find((e) => e.size === "S")).toEqual({ chartNumber: 13, size: "S", chestWidthCm: 48, bottomLengthCm: 89 });
    expect(sma).toBe(SMA_SIZE_CHART);
    expect(TK_SIZE_CHART[0].size).toBe("S");
    expect(SD_SIZE_CHART[0].size).toBe("S");
  });

  it("formats size label informatively", () => {
    const label = formatUniformSizeLabel({ chartNumber: 8, size: "M", chestWidthCm: 44, bottomLengthCm: 79 });
    expect(label).toBe("M (No 8 — LD: 44 cm, P: 79 cm)");
  });

  it("filters official sport sizes by jenjang accurately (ADR-0024)", () => {
    expect(getOfficialSportSizesForJenjang("tk")).toEqual(["S", "M", "L", "XL"]);
    expect(getOfficialSportSizesForJenjang("sd")).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL"]);
    expect(getOfficialSportSizesForJenjang("smp")).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
    expect(getOfficialSportSizesForJenjang("sma")).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
  });
});
