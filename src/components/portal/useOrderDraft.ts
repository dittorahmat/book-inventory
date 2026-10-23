import { useMemo, useState } from "react";

/**
 * Draf pembayaran portal: satu modul pemilik state + transisi, bukan 14
 * pasangan nilai/setter yang harus diketahui setiap step. Server tetap
 * otoritas terakhir; modul ini hanya menyatukan cara draf dibentuk.
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

export interface OrderDraftActions {
  setOrderType: (value: OrderDraft["orderType"]) => void;
  setScholarshipProofBase64: (value: string) => void;
  setPaymentChoice: (value: OrderDraft["paymentChoice"]) => void;
  setTransferAmount: (value: number) => void;
  setBookAllocationAmount: (value: number) => void;
  setBankName: (value: string) => void;
  setReferenceNumber: (value: string) => void;
  setPaymentProofBase64: (value: string) => void;
  setFinanceProofBase64: (value: string) => void;
  setParentPhoneManual: (value: string) => void;
  setNotes: (value: string) => void;
  setHomeAddress: (value: string) => void;
  setPaketKirim: (value: boolean) => void;
  setHasTakenPackage: (value: boolean | null) => void;
  setWprPrice: (value: number) => void;
  /** Isi dua nominal sekaligus (paket terkunci) tanpa menimpa edit manual. */
  setAmounts: (transferAmount: number, bookAllocationAmount: number) => void;
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

  const actions = useMemo<OrderDraftActions>(() => {
    const set =
      <K extends keyof OrderDraft>(key: K) =>
      (value: OrderDraft[K]) =>
        setDraft((previous) => ({ ...previous, [key]: value }));

    return {
      setOrderType: set("orderType"),
      setScholarshipProofBase64: set("scholarshipProofBase64"),
      setPaymentChoice: set("paymentChoice"),
      setTransferAmount: set("transferAmount"),
      setBookAllocationAmount: set("bookAllocationAmount"),
      setBankName: set("bankName"),
      setReferenceNumber: set("referenceNumber"),
      setPaymentProofBase64: set("paymentProofBase64"),
      setFinanceProofBase64: set("financeProofBase64"),
      setParentPhoneManual: set("parentPhoneManual"),
      setNotes: set("notes"),
      setHomeAddress: set("homeAddress"),
      setPaketKirim: set("paketKirim"),
      setHasTakenPackage: set("hasTakenPackage"),
      setWprPrice: set("wprPrice"),
      setAmounts: (transferAmount, bookAllocationAmount) =>
        setDraft((previous) => ({ ...previous, transferAmount, bookAllocationAmount })),
    };
  }, []);

  return { draft, actions };
}
