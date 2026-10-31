import { useMemo, useState } from "react";
import { allocationForChoice } from "./order-draft";

/**
 * Draf pembayaran portal: satu modul pemilik state + transisi, bukan belasan
 * pasangan nilai/setter yang harus diketahui setiap step (AGENTS §0.8).
 * Step hanya mengirim niat domain ("pilih skema bayar", "lampirkan bukti");
 * aturan turunan (nominal alokasi preset) tetap di sini, bukan di JSX.
 * Server tetap otoritas terakhir.
 */
export interface OrderDraft {
  orderType: "regular" | "scholarship";
  scholarshipProofBase64: string;
  paymentChoice: "full" | "partial";
  transferAmount: number;
  bookAllocationAmount: number;
  bankName: string;
  referenceNumber: string;
  paymentProofBase64: string;
  financeProofBase64: string;
  parentPhoneManual: string;
  notes: string;
  homeAddress: string;
  paketKirim: boolean;
  hasTakenPackage: boolean | null;
  wprPrice: number;
}

/** Tiga slot bukti dokumen portal; satu pintu lampiran, bukan tiga setter. */
export type DraftProofSlot = "scholarship" | "payment" | "finance";

const PROOF_FIELD: Record<DraftProofSlot, keyof OrderDraft> = {
  scholarship: "scholarshipProofBase64",
  payment: "paymentProofBase64",
  finance: "financeProofBase64",
};

export interface OrderDraftActions {
  /** Isian bebas (teks/angka) yang tidak membawa transisi domain. */
  edit: (patch: Partial<OrderDraft>) => void;
  /** Pilih jalur pendaftaran. */
  chooseOrderType: (orderType: OrderDraft["orderType"]) => void;
  /**
   * Pilih skema bayar sekaligus nominal alokasi preset-nya. Dulu dua setter
   * dipanggil berpasangan di JSX sehingga tombol "Lunas"/"Cicilan" bisa lupa
   * menyelaraskan nominal.
   */
  choosePaymentScheme: (input: { choice: OrderDraft["paymentChoice"]; bookTotal: number }) => void;
  /** Lampirkan bukti pada slot yang sesuai. */
  attachProof: (slot: DraftProofSlot, base64: string) => void;
  /** Isi dua nominal sekaligus (paket terkunci) tanpa parameter posisional. */
  setAmounts: (input: { transferAmount: number; bookAllocationAmount: number }) => void;
  /** Jawaban "paket sudah diambil" — null berarti belum dijawab. */
  setHasTakenPackage: (value: boolean | null) => void;
  /** Pilih pengiriman paket ke rumah. */
  setPaketKirim: (value: boolean) => void;
  /** Harga WPR hasil kelayakan murid. */
  setWprPrice: (price: number) => void;
}

const EMPTY_DRAFT: OrderDraft = {
  orderType: "regular",
  scholarshipProofBase64: "",
  paymentChoice: "full",
  transferAmount: 0,
  bookAllocationAmount: 0,
  bankName: "BCA",
  referenceNumber: "",
  paymentProofBase64: "",
  financeProofBase64: "",
  parentPhoneManual: "",
  notes: "",
  homeAddress: "",
  paketKirim: false,
  hasTakenPackage: null,
  wprPrice: 0,
};

export function useOrderDraft(initialWprPrice: number) {
  const [draft, setDraft] = useState<OrderDraft>({ ...EMPTY_DRAFT, wprPrice: initialWprPrice });

  const actions = useMemo<OrderDraftActions>(
    () => ({
      edit: (patch) => setDraft((previous) => ({ ...previous, ...patch })),
      chooseOrderType: (orderType) => setDraft((previous) => ({ ...previous, orderType })),
      choosePaymentScheme: ({ choice, bookTotal }) =>
        setDraft((previous) => ({
          ...previous,
          paymentChoice: choice,
          bookAllocationAmount: allocationForChoice(choice, bookTotal),
        })),
      attachProof: (slot, base64) =>
        setDraft((previous) => ({ ...previous, [PROOF_FIELD[slot]]: base64 })),
      setAmounts: ({ transferAmount, bookAllocationAmount }) =>
        setDraft((previous) => ({ ...previous, transferAmount, bookAllocationAmount })),
      setHasTakenPackage: (hasTakenPackage) => setDraft((previous) => ({ ...previous, hasTakenPackage })),
      setPaketKirim: (paketKirim) => setDraft((previous) => ({ ...previous, paketKirim })),
      setWprPrice: (wprPrice) => setDraft((previous) => ({ ...previous, wprPrice })),
    }),
    []
  );

  return { draft, actions };
}
