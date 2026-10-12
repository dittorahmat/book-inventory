/** Kanonik tipe + pemetaan jenjang seragam (dipakai backend & frontend). */
import type { StudentSearchResult } from "./portal-types";

/** Hasil cari murid portal seragam: sama + gender (untuk filter L/P). */
export type UniformStudent = StudentSearchResult & { gender: "male" | "female" | null };

export const UNIFORM_JENJANG = ["tk", "sd", "smp", "sma"] as const;
export type UniformJenjang = (typeof UNIFORM_JENJANG)[number];



/** gradeLevel murid ("0"/"TK" → tk, "1–6" → sd, "7–9" → smp, "10–12" → sma). */
export const gradeToJenjang = (gradeLevel: string): UniformJenjang => {
  const g = gradeLevel.trim().toLowerCase();
  if (g === "0" || g === "tk" || g === "pg") return "tk";
  const n = Number.parseInt(g, 10);
  if (Number.isNaN(n)) return "sd";
  return n >= 10 ? "sma" : n >= 7 ? "smp" : "sd";
};

export interface UniformVariantOption {
  id: string;
  code: string;
  name: string;
  kind: "kain_harian" | "olahraga";
  gender: "male" | "female";
  jenjang: UniformJenjang;
  academicYear: string;
  price: number;
  sizeChartUrl: string | null;
  sizes: string[];
  stock: Array<{ size: string; quantity: number }>;
}

export interface UniformPackageOption {
  id: string;
  code: string;
  name: string;
  academicYear: string;
  price: number;
  readyQty: number;
  bom: Array<{ variantId: string; variantName: string; kind: string; size: string; quantity: number }>;
}

export interface UniformCatalog {
  variants: UniformVariantOption[];
  packages: UniformPackageOption[];
}

export interface SubmitUniformOrderItem {
  packageId?: string;
  variantId?: string;
  size?: string;
  quantity?: number;
}

export interface SubmitUniformOrderPayload {
  studentId: string;
  academicYear: string;
  homeAddress: string;
  items: SubmitUniformOrderItem[];
  sizeOverrides?: Record<string, string>;
  notes?: string;
}
