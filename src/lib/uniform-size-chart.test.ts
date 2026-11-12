import { describe, expect, it } from "bun:test";
import {
  getUniformSizeChart,
  normalizeUniformJenjang,
  formatUniformSizeLabel,
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

  it("retrieves official SMP/SMA size chart (S to 5XL with matching cm)", () => {
    const smp = getUniformSizeChart("smp");
    expect(smp.map((e) => e.size)).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
    expect(smp.find((e) => e.size === "5XL")).toEqual({ chartNumber: 20, size: "5XL", chestWidthCm: 62, bottomLengthCm: 108 });
  });

  it("formats size label informatively", () => {
    const label = formatUniformSizeLabel({ chartNumber: 8, size: "M", chestWidthCm: 44, bottomLengthCm: 79 });
    expect(label).toBe("M (No 8 — LD: 44 cm, P: 79 cm)");
  });
});
