export type UniformEducationLevel = "TK" | "SD" | "SMP" | "SMA";

export interface UniformSizeChartEntry {
  chartNumber: number;
  size: string;
  chestWidthCm: number;
  bottomLengthCm: number;
}

export const UNIFORM_SIZE_CHARTS: Record<UniformEducationLevel, readonly UniformSizeChartEntry[]> = {
  TK: [
    { chartNumber: 4, size: "S", chestWidthCm: 36, bottomLengthCm: 57 },
    { chartNumber: 5, size: "M", chestWidthCm: 38, bottomLengthCm: 59 },
    { chartNumber: 6, size: "L", chestWidthCm: 40, bottomLengthCm: 63 },
    { chartNumber: 7, size: "XL", chestWidthCm: 42, bottomLengthCm: 75 },
  ],
  SD: [
    { chartNumber: 7, size: "S", chestWidthCm: 42, bottomLengthCm: 76 },
    { chartNumber: 8, size: "M", chestWidthCm: 44, bottomLengthCm: 79 },
    { chartNumber: 9, size: "L", chestWidthCm: 46, bottomLengthCm: 82 },
    { chartNumber: 13, size: "XL", chestWidthCm: 48, bottomLengthCm: 88 },
    { chartNumber: 14, size: "2XL", chestWidthCm: 50, bottomLengthCm: 93 },
    { chartNumber: 15, size: "3XL", chestWidthCm: 52, bottomLengthCm: 94 },
    { chartNumber: 16, size: "4XL", chestWidthCm: 54, bottomLengthCm: 97 },
  ],
  SMP: [
    { chartNumber: 13, size: "S", chestWidthCm: 48, bottomLengthCm: 89 },
    { chartNumber: 14, size: "M", chestWidthCm: 50, bottomLengthCm: 92 },
    { chartNumber: 15, size: "L", chestWidthCm: 52, bottomLengthCm: 94 },
    { chartNumber: 16, size: "XL", chestWidthCm: 54, bottomLengthCm: 97 },
    { chartNumber: 17, size: "2XL", chestWidthCm: 56, bottomLengthCm: 102 },
    { chartNumber: 18, size: "3XL", chestWidthCm: 58, bottomLengthCm: 104 },
    { chartNumber: 19, size: "4XL", chestWidthCm: 60, bottomLengthCm: 106 },
    { chartNumber: 20, size: "5XL", chestWidthCm: 62, bottomLengthCm: 108 },
  ],
  SMA: [
    { chartNumber: 13, size: "S", chestWidthCm: 48, bottomLengthCm: 89 },
    { chartNumber: 14, size: "M", chestWidthCm: 50, bottomLengthCm: 92 },
    { chartNumber: 15, size: "L", chestWidthCm: 52, bottomLengthCm: 94 },
    { chartNumber: 16, size: "XL", chestWidthCm: 54, bottomLengthCm: 97 },
    { chartNumber: 17, size: "2XL", chestWidthCm: 56, bottomLengthCm: 102 },
    { chartNumber: 18, size: "3XL", chestWidthCm: 58, bottomLengthCm: 104 },
    { chartNumber: 19, size: "4XL", chestWidthCm: 60, bottomLengthCm: 106 },
    { chartNumber: 20, size: "5XL", chestWidthCm: 62, bottomLengthCm: 108 },
  ],
};

export function normalizeUniformJenjang(raw?: string | null): UniformEducationLevel {
  const norm = (raw || "").trim().toUpperCase();
  if (norm.includes("TK")) return "TK";
  if (norm.includes("SD")) return "SD";
  if (norm.includes("SMP")) return "SMP";
  if (norm.includes("SMA") || norm.includes("SMK")) return "SMA";
  return "SD";
}

export function getUniformSizeChart(jenjang?: string | null): readonly UniformSizeChartEntry[] {
  const level = normalizeUniformJenjang(jenjang);
  return UNIFORM_SIZE_CHARTS[level] ?? UNIFORM_SIZE_CHARTS.SD;
}

export function formatUniformSizeLabel(entry: UniformSizeChartEntry): string {
  return `${entry.size} (No ${entry.chartNumber} — LD: ${entry.chestWidthCm} cm, P: ${entry.bottomLengthCm} cm)`;
}
