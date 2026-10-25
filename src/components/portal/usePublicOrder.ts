import { useState, useEffect } from "react";
import { resolveLockedPackage } from "../../lib/resolve-package";
import { calcLooseOrderTotal } from "../../lib/book-pricing";
import {
  submitFinalOrder,
  fetchWprEligibility,
} from "./portal-api";
import { WPR_PRICE } from "../../lib/wpr";
import { buildFinalOrderPayload } from "./order-payload";
import { usePortalCatalog } from "./usePortalCatalog";
import { useOrderDraft } from "./useOrderDraft";
import {
  useStudentSearch,
  PORTAL_STUDENT_SEARCH_INPUT_ID,
  getPendingNoResultQuery,
} from "./useStudentSearch";
import type { LooseSelection } from "./OrderItemStep";
import type {
  StudentSearchResult,
  FileUploadHandler,
} from "../../lib/portal-types";

export type OrderStep = 1 | 2 | 3 | 4;
export type PortalTab = "order" | "uniform" | "uniform_return" | "book_return";

export { PORTAL_STUDENT_SEARCH_INPUT_ID, getPendingNoResultQuery };

function focusStudentSearchInput() {
  if (typeof document === "undefined") return;
  const focus = () => document.getElementById(PORTAL_STUDENT_SEARCH_INPUT_ID)?.focus();
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => focus());
  else focus();
}

export function usePublicOrder(initialTab: PortalTab = "order") {
  const [activePortalTab, setActivePortalTab] = useState<PortalTab>(initialTab);

  // Katalog server: milik usePortalCatalog, dipakai bersama alur retur.
  const catalog = usePortalCatalog();
  const { schools, packages, satuanBooks, satuanOpen } = catalog;

  // Step wizard: 1 = Student Selection, 2 = Locked Package Detail,
  // 3 = Payment / Scholarship, 4 = Success
  const [step, setStep] = useState<OrderStep>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const search = useStudentSearch({
    schools,
    onSelectStudent: (st) => {
      if (st.canOrder === false) {
        setErrorMessage(st.orderBlockedReason ?? "Data siswa masih menunggu verifikasi admin sekolah.");
        return;
      }
      setErrorMessage(null);
      applyLockedPackage(st);
      setStep(2);
    },
    onError: setErrorMessage,
  });

  const {
    searchSchoolId, setSearchSchoolId,
    searchQuery, setSearchQuery,
    isSearching, searchResults,
    selectedStudent, setSelectedStudent,
    isNewStudentMode, setIsNewStudentMode,
    pendingNoResult,
    newStudent, setNewStudent,
    verificationPending, setVerificationPending,
    handleSearch, handleSelectStudent,
    confirmNoResult: confirmCreateNewStudent,
    cancelNoResult,
    handleRegisterNewStudent,
  } = search;

  // Package & Order State
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");

  // Order satuan (hanya tersedia saat periode satuan dibuka; milik katalog).
  const [packageMode, setPackageMode] = useState(true);
  const [looseSelections, setLooseSelections] = useState<LooseSelection[]>([]);

  const looseTotal = calcLooseOrderTotal(looseSelections, satuanBooks);

  // Draf pembayaran: satu modul pemilik state + transisi (useOrderDraft).
  const { draft, actions: draftActions } = useOrderDraft(WPR_PRICE);
  const {
    orderType,
    scholarshipProofBase64,
    transferAmount,
    bookAllocationAmount,
    bankName,
    referenceNumber,
    paymentProofBase64,
    notes,
    homeAddress,
    paketKirim,
    hasTakenPackage,
    wprPrice,
  } = draft;
  const { setPaketKirim, setHasTakenPackage, setWprPrice, setAmounts } = draftActions;

  // WPR satuan buku: jawaban paket (default dari server) + biaya estimasi.
  const [wprLoading, setWprLoading] = useState(false);
  const wprFee = !packageMode && hasTakenPackage === false ? wprPrice : 0;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<any>(null);

  // Pindah step selalu menghapus error lama agar banner tidak bocor antar step
  const goToStep = (next: OrderStep) => {
    setErrorMessage(null);
    setStep(next);
  };

  // Locked package resolution: single package matching
  // (targetGradeLevel, curriculumType), preferring latest academicYear.
  // Re-runs when the package list arrives after a student was selected.
  // Nominal pembayaran hanya diisi otomatis saat masih murni (0): reload
  // katalog di background tidak boleh menimpa edit manual orang tua.
  useEffect(() => {
    if (!selectedStudent || packages.length === 0 || step < 2) return;
    const matched = resolveLockedPackage(selectedStudent, packages);
    const nextId = matched ? matched.id : "";
    if (nextId === selectedPackageId) return;
    setSelectedPackageId(nextId);
    if (matched && transferAmount === 0 && bookAllocationAmount === 0) {
      setAmounts(matched.price, matched.price);
    }
  }, [packages, selectedStudent, step, selectedPackageId, transferAmount, bookAllocationAmount, setAmounts]);

  const applyLockedPackage = (st: StudentSearchResult) => {
    const matched = resolveLockedPackage(st, packages);
    if (matched) {
      setSelectedPackageId(matched.id);
      setAmounts(matched.price, matched.price);
    } else {
      setSelectedPackageId("");
    }
  };

  useEffect(() => {
    if (!satuanOpen) {
      setPackageMode(true);
      setLooseSelections([]);
    }
  }, [satuanOpen]);

  // Default jawaban paket dari status server saat murid dipilih.
  useEffect(() => {
    if (!selectedStudent || !satuanOpen) return;
    setWprLoading(true);
    fetchWprEligibility(selectedStudent.id)
      .then((elig) => {
        setHasTakenPackage(!elig.needsWpr);
        if (elig.wprPrice > 0) setWprPrice(elig.wprPrice);
      })
      .catch(() => setHasTakenPackage(false))
      .finally(() => setWprLoading(false));
  }, [selectedStudent, satuanOpen, setHasTakenPackage, setWprPrice]);

  useEffect(() => {
    if (catalog.loadError) setErrorMessage(catalog.loadError);
  }, [catalog.loadError]);

  const handleLooseQuantityChange = (bookId: string, quantity: number) => {
    setLooseSelections((prev) => {
      const rest = prev.filter((s) => s.bookId !== bookId);
      return quantity > 0 ? [...rest, { bookId, quantity }] : rest;
    });
  };

  const resetLooseSelection = () => setLooseSelections([]);

  const editNoResultKeyword = () => {
    cancelNoResult();
    focusStudentSearchInput();
  };

  const handleFileUpload: FileUploadHandler = (e, setter) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const handleSubmitFinalOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = buildFinalOrderPayload({
        studentId: selectedStudent.id,
        packageMode,
        packageId: selectedPackage?.id,
        packagePrice: selectedPackage?.price ?? 0,
        looseItems: looseSelections,
        looseTotal,
        paketKirim,
        wprFee,
        orderType,
        scholarshipProofBase64,
        financeProofBase64: draft.financeProofBase64,
        parentPhoneManual: draft.parentPhoneManual,
        transferAmount,
        bookAllocationAmount,
        bankName,
        referenceNumber,
        paymentProofBase64,
        notes,
        homeAddress,
      });
      const data = await submitFinalOrder(payload);

      setSubmittedOrder(data);
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kendala saat mengirimkan pemesanan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetOrderFlow = () => {
    setStep(1);
    setErrorMessage(null);
    setSelectedStudent(null);
    setVerificationPending(null);
    setIsNewStudentMode(false);
    cancelNoResult();
    setSearchQuery("");
    setPackageMode(true);
    resetLooseSelection();
    setHasTakenPackage(null);
    setPaketKirim(false);
  };

  return {
    activePortalTab, setActivePortalTab,
    schools, packages, step, setStep, goToStep,
    searchSchoolId, setSearchSchoolId,
    searchQuery, setSearchQuery, isSearching, searchResults,
    selectedStudent, isNewStudentMode, setIsNewStudentMode,
    pendingNoResult, confirmCreateNewStudent, cancelNoResult, editNoResultKeyword,
    verificationPending, setVerificationPending,
    newStudent, setNewStudent,
    selectedPackageId, selectedPackage,
    satuanOpen, satuanBooks, packageMode, setPackageMode,
    looseSelections, looseTotal, handleLooseQuantityChange, resetLooseSelection,
    draft, draftActions, wprFee, wprLoading,
    isSubmitting, errorMessage, setErrorMessage, submittedOrder,
    handleSearch, handleSelectStudent, handleRegisterNewStudent,
    handleFileUpload, handleSubmitFinalOrder,
    resetOrderFlow,
  };
}
