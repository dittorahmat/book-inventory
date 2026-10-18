import { formatRupiah } from "../../lib/transfer-pricing";
import type { BookPackageOption, StudentSearchResult } from "../../lib/portal-types";
import type { LooseSelection } from "./OrderItemStep";

/**
 * Satu-satunya pemilik draf order portal: total tagihan + preset
 * alokasi + sisa + baris satuan tinggal di balik satu seam ini.
 * Hook tetap memegang state, PaymentStep me-render verbatim, view tak
 * lagi merakit pkg satuan sendiri — satu sumber, tiga pemakai.
 * Total identik dengan payload (paket ? harga : satuan + WPR).
 */
export const calcDraftTotal = (input: {
  packageMode: boolean;
  packagePrice: number;
  looseTotal: number;
  wprFee: number;
}): number => (input.packageMode ? input.packagePrice : input.looseTotal + input.wprFee);

export const allocationForChoice = (choice: "full" | "partial", bookTotal: number): number =>
  choice === "full" ? bookTotal : Math.round(bookTotal / 2);

export const draftRemainder = (bookTotal: number, allocation: number): number =>
  Math.max(0, bookTotal - allocation);

export type AllocationCheck = { ok: true } | { ok: false; message: string };

/**
 * Guard alokasi yang sama dipakai form (pesan inline) dan payload (tolak kirim):
 * alokasi tidak boleh nol, tidak boleh melebihi nominal struk, dan tidak boleh
 * melebihi total tagihan. Ketiganya wajib — satu struk sering menutup SPP juga.
 */
export const validateAllocation = (input: {
  transferAmount: number;
  allocationAmount: number;
  bookTotal: number;
}): AllocationCheck => {
  if (input.allocationAmount < 1) {
    return { ok: false, message: "Alokasi untuk buku minimal Rp 1." };
  }
  if (input.allocationAmount > input.bookTotal) {
    return {
      ok: false,
      message: `Alokasi ${formatRupiah(input.allocationAmount)} melebihi total tagihan ${formatRupiah(input.bookTotal)}.`,
    };
  }
  if (input.transferAmount > 0 && input.allocationAmount > input.transferAmount) {
    return {
      ok: false,
      message: `Alokasi ${formatRupiah(input.allocationAmount)} melebihi total struk ${formatRupiah(input.transferAmount)}.`,
    };
  }
  return { ok: true };
};

/** Baris pkg satuan untuk PaymentStep: harga sudah termasuk WPR sekali. */
export const buildSatuanPkg = (input: {
  student: StudentSearchResult;
  looseSelections: LooseSelection[];
  looseTotal: number;
  wprFee: number;
}): BookPackageOption => ({
  id: "satuan",
  code: "SATUAN",
  name: `Buku satuan (${input.looseSelections.length} judul)`,
  gradeLevel: input.student.gradeLevel,
  curriculumType: input.student.curriculumType,
  academicYear: input.student.academicYear,
  price: input.looseTotal + input.wprFee,
  totalItemsCount: input.looseSelections.length,
  items: [],
});
