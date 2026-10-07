import { formatRupiah } from "../../lib/transfer-pricing";

/** Alias kanonik ke formatRupiah agar output Rp konsisten di seluruh UI. */
export const formatRp = (n: number): string => formatRupiah(n);

export function coverageTone(ratio: number | null): { text: string; pill: string; bar: string } {
  if (ratio === null) return { text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "#10B981" };
  if (ratio >= 1) return { text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "#10B981" };
  if (ratio >= 0.8) return { text: "text-[#1877F2]", pill: "bg-[#E7F3FF] text-[#1877F2] border-[#1877F2]/20", bar: "#1877F2" };
  if (ratio >= 0.5) return { text: "text-amber-700", pill: "bg-amber-50 text-amber-700 border-amber-200", bar: "#F59E0B" };
  return { text: "text-red-700", pill: "bg-red-50 text-red-700 border-red-200", bar: "#EF4444" };
}
