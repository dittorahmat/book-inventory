export type UniformCatalogRowInput = unknown[];

export interface ParsedUniformVariant {
  id: string;
  code: string;
  name: string;
  kind: "kain_harian" | "olahraga";
  gender: "male" | "female";
  jenjang: "tk" | "sd" | "smp" | "sma";
  academicYear: string;
  price: number;
  sizeChartUrl: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
  sizes: string[];
}

export interface DefaultUniformPackageDefinition {
  id: string;
  code: string;
  name: string;
  jenjang: "tk" | "sd" | "smp" | "sma";
  gender: "male" | "female";
  academicYear: string;
  price: number;
  description: string;
  items: Array<{ variantId: string; quantity: number }>;
}

export const KAIN_SIZE = "STANDAR";

export const SPORT_SIZES_BY_JENJANG: Record<string, string[]> = {
  tk: ["S", "M", "L", "XL"],
  sd: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
  smp: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
  sma: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
};

export function parseJenjang(header: string): "tk" | "sd" | "smp" | "sma" {
  const tokens = header.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.includes("TK")) return "tk";
  if (tokens.includes("SD")) return "sd";
  if (tokens.includes("SMP")) return "smp";
  return "sma";
}

export function parseGender(header: string): "male" | "female" {
  return header.toUpperCase().includes("AKHWAT") ? "female" : "male";
}

export interface ParseCatalogOptions {
  academicYear: string;
  sizeChartUrl?: string | null;
  now?: string;
}

export function parseUniformCatalogRows(
  rows: UniformCatalogRowInput[],
  options: ParseCatalogOptions
): { variants: ParsedUniformVariant[]; skippedCount: number } {
  const now = options.now ?? new Date().toISOString();
  const academicYear = options.academicYear;
  const sizeChartUrl = options.sizeChartUrl ?? null;

  let currentHeader = "";
  const variants: ParsedUniformVariant[] = [];
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    if (row[0] && String(row[0]).trim()) {
      currentHeader = String(row[0]).trim();
    }

    const rawItemName = row[1] ? String(row[1]).trim() : "";
    const rawPrice = row[2];

    const price = typeof rawPrice === "number" ? rawPrice : Number(String(rawPrice || "").replace(/[^0-9]/g, ""));

    if (!rawItemName || !currentHeader || Number.isNaN(price) || price <= 0) {
      if (rawItemName && !Number.isNaN(price) && price > 0 && !currentHeader) {
        skippedCount++;
      }
      continue;
    }

    const jenjang = parseJenjang(currentHeader);
    const gender = parseGender(currentHeader);
    const isSport = rawItemName.toUpperCase().includes("OLAHRAGA");
    const kind: "kain_harian" | "olahraga" = isSport ? "olahraga" : "kain_harian";

    const itemSlug = rawItemName.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
    const code = `UNI-${jenjang.toUpperCase()}-${gender === "male" ? "IKH" : "AKH"}-${itemSlug}`;
    const id = `uv-${code.toLowerCase().replace(/_/g, "-")}`;

    const sizes = isSport ? (SPORT_SIZES_BY_JENJANG[jenjang] ?? []) : [KAIN_SIZE];

    variants.push({
      id,
      code,
      name: `${rawItemName} (${jenjang.toUpperCase()} ${gender === "male" ? "Ikhwan" : "Akhwat"})`,
      kind,
      gender,
      jenjang,
      academicYear,
      price,
      sizeChartUrl: isSport ? sizeChartUrl : null,
      description: `Katalog Seragam ${academicYear} - ${currentHeader}`,
      createdAt: now,
      updatedAt: now,
      sizes,
    });
  }

  return { variants, skippedCount };
}

export function buildDefaultUniformPackages(
  variants: ParsedUniformVariant[],
  academicYear: string
): DefaultUniformPackageDefinition[] {
  const groups: Record<string, ParsedUniformVariant[]> = {};

  for (const v of variants) {
    if (v.kind !== "kain_harian") continue; // Hanya kain harian yang dibundel ke paket
    const key = `${v.jenjang}_${v.gender}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  }

  const defs: DefaultUniformPackageDefinition[] = [];
  for (const [key, list] of Object.entries(groups)) {
    const [jenjang, gender] = key.split("_") as ["tk" | "sd" | "smp" | "sma", "male" | "female"];
    const jenjangLabel = jenjang.toUpperCase();
    const genderLabel = gender === "male" ? "Ikhwan" : "Akhwat";
    const genderSlug = gender === "male" ? "IKH" : "AKH";
    const yearSlug = academicYear.replace(/[^0-9]/g, "").slice(0, 4) || "2026";
    const code = `PKG-UNIF-${jenjangLabel}-${genderSlug}-${yearSlug}`;
    const id = `pkg-${code.toLowerCase().replace(/_/g, "-")}`;
    const name = `Paket Bahan Seragam Harian ${jenjangLabel} ${genderLabel} TA ${academicYear}`;
    const totalPrice = list.reduce((sum, item) => sum + item.price, 0);

    defs.push({
      id,
      code,
      name,
      jenjang,
      gender,
      academicYear,
      price: totalPrice,
      description: `Paket seragam harian standar ${jenjangLabel} ${genderLabel} TA ${academicYear} (${list.length} item bahan).`,
      items: list.map((v) => ({ variantId: v.id, quantity: 1 })),
    });
  }

  return defs;
}
