/**
 * Satu aturan alokasi Struk Bayar untuk klien dan server. Klien memakainya
 * untuk pesan inline; kernel struk memakainya untuk menolak baris mustahil.
 * `billAmount` adalah tagihan order (barang + ongkir), bukan nominal struk.
 */

export type AllocationViolation = "below_minimum" | "above_bill" | "above_receipt";

export interface AllocationRuleInput {
  allocationAmount: number;
  transferAmount: number;
  billAmount: number;
}

/** Null = sah. Urutan cek menentukan pesan yang dipilih pemanggil. */
export const allocationViolation = (input: AllocationRuleInput): AllocationViolation | null => {
  if (input.allocationAmount < 1) return "below_minimum";
  if (input.allocationAmount > input.billAmount) return "above_bill";
  if (input.allocationAmount > input.transferAmount) return "above_receipt";
  return null;
};
