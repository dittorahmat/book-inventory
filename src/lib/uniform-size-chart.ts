import type { UniformJenjang } from "./uniform-types";

export interface UniformSizeChartEntry {
  chartNumber: number;
  size: string;
  chestWidthCm: number;
  bottomLengthCm: number;
}

const TK_SIZE_CHART: readonly UniformSizeChartEntry[] = [
  { chartNumber: 4, size: "S", chestWidthCm: 36, bottomLengthCm: 57 },
  { chartNumber: 5, size: "M", chestWidthCm: 38, bottomLengthCm: 59 },
  { chartNumber: 6, size: "L", chestWidthCm: 40, bottomLengthCm: 63 },
  { chartNumber: 7, size: "XL", chestWidthCm: 42, bottomLengthCm: 75 },
];

const SD_SIZE_CHART: readonly UniformSizeChartEntry[] = [
  { chartNumber: 7, size: "S", chestWidthCm: 42, bottomLengthCm: 76 },
  { chartNumber: 8, size: "M", chestWidthCm: 44, bottomLengthCm: 79 },
  { chartNumber: 9, size: "L", chestWidthCm: 46, bottomLengthCm: 82 },
  { chartNumber: 13, size: "XL", chestWidthCm: 48, bottomLengthCm: 88 },
  { chartNumber: 14, size: "2XL", chestWidthCm: 50, bottomLengthCm: 93 },
  { chartNumber: 15, size: "3XL", chestWidthCm: 52, bottomLengthCm: 94 },
  { chartNumber: 16, size: "4XL", chestWidthCm: 54, bottomLengthCm: 97 },
];

const SMP_SMA_SIZE_CHART: readonly UniformSizeChartEntry[] = [
  { chartNumber: 13, size: "S", chestWidthCm: 48, bottomLengthCm: 89 },
  { chartNumber: 14, size: "M", chestWidthCm: 50, bottomLengthCm: 92 },
  { chartNumber: 15, size: "L", chestWidthCm: 52, bottomLengthCm: 94 },
  { chartNumber: 16, size: "XL", chestWidthCm: 54, bottomLengthCm: 97 },
  { chartNumber: 17, size: "2XL", chestWidthCm: 56, bottomLengthCm: 102 },
  { chartNumber: 18, size: "3XL", chestWidthCm: 58, bottomLengthCm: 104 },
  { chartNumber: 19, size: "4XL", chestWidthCm: 60, bottomLengthCm: 106 },
  { chartNumber: 20, size: "5XL", chestWidthCm: 62, bottomLengthCm: 108 },
];

export const UNIFORM_SIZE_CHARTS: Record<UniformJenjang, readonly UniformSizeChartEntry[]> = {
  tk: TK_SIZE_CHART,
  sd: SD_SIZE_CHART,
  smp: SMP_SMA_SIZE_CHART,
  sma: SMP_SMA_SIZE_CHART,
};

export function normalizeUniformJenjang(raw?: string | null): UniformJenjang {
  const norm = (raw || "").trim().toLowerCase();
  if (norm.includes("tk") || norm.includes("pg") || norm === "0") return "tk";
  if (norm.includes("smp")) return "smp";
  if (norm.includes("sma") || norm.includes("smk")) return "sma";
  return "sd";
}

export function getUniformSizeChart(jenjang?: string | null): readonly UniformSizeChartEntry[] {
  const level = normalizeUniformJenjang(jenjang);
  return UNIFORM_SIZE_CHARTS[level] ?? UNIFORM_SIZE_CHARTS.sd;
}

export function formatUniformSizeLabel(entry: UniformSizeChartEntry): string {
  return `${entry.size} (No ${entry.chartNumber} — LD: ${entry.chestWidthCm} cm, P: ${entry.bottomLengthCm} cm)`;
}
