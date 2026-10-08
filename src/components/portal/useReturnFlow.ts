import { useState } from "react";
import {
  lookupOrders,
  fetchBookChoices,
  submitReturnReport,
} from "./portal-api";
import type {
  BookPackageOption,
  MatchedOrder,
  PackageBookChoice,
} from "../../lib/portal-types";

export function useReturnFlow(packages: BookPackageOption[]) {
  const [returnLookupQuery, setReturnLookupQuery] = useState("");
  const [isLookingUpReturn, setIsLookingUpReturn] = useState(false);
  const [returnErrorMessage, setReturnErrorMessage] = useState<string | null>(null);
  const [matchedOrders, setMatchedOrders] = useState<MatchedOrder[]>([]);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<MatchedOrder | null>(null);
  const [packageBookList, setPackageBookList] = useState<PackageBookChoice[]>([]);
  const [selectedDefectiveBookId, setSelectedDefectiveBookId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [defectPhotoBase64, setDefectPhotoBase64] = useState<string>("");
  const [returnSuccessData, setReturnSuccessData] = useState<any>(null);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const handleLookupOrderForReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returnLookupQuery.trim().length < 3) return;
    setIsLookingUpReturn(true);
    setReturnErrorMessage(null);
    setSelectedReturnOrder(null);
    setPackageBookList([]);

    try {
      const orders = await lookupOrders(returnLookupQuery);
      setMatchedOrders(orders);
    } catch (err: any) {
      setReturnErrorMessage(err.message || "Gagal mencari pesanan. Periksa koneksi atau nomor pesanan.");
      setMatchedOrders([]);
    } finally {
      setIsLookingUpReturn(false);
    }
  };

  const handleSelectOrderForReturn = async (order: MatchedOrder) => {
    setSelectedReturnOrder(order);
    setReturnErrorMessage(null);

    try {
      const pkg = packages.find((p) => p.id === order.packageId);
      if (pkg && pkg.items && pkg.items.length > 0) {
        setPackageBookList(
          pkg.items.map((it: any) => ({
            bookId: it.bookId || it.id,
            title: it.title,
            isbn: it.isbn || "-",
          }))
        );
        if (pkg.items[0]) {
          setSelectedDefectiveBookId((pkg.items[0].bookId || pkg.items[0].id) ?? "");
        }
      } else {
        const choices = await fetchBookChoices();
        setPackageBookList(choices);
        if (choices[0]) {
          setSelectedDefectiveBookId(choices[0].bookId);
        }
      }
    } catch (err: any) {
      setReturnErrorMessage(err.message || "Gagal memuat pilihan buku. Silakan coba lagi.");
    }
  };

  const handleSubmitReturnReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnOrder || !selectedDefectiveBookId) return;
    setIsSubmittingReturn(true);
    setReturnErrorMessage(null);

    try {
      if (!defectPhotoBase64) {
        throw new Error("Foto bukti fisik buku rusak/cacat wajib diunggah.");
      }

      const data = await submitReturnReport({
        orderId: selectedReturnOrder.id,
        studentId: selectedReturnOrder.studentId,
        defectiveBookId: selectedDefectiveBookId,
        reason: returnReason.trim(),
        photoProofBase64: defectPhotoBase64,
      });

      setReturnSuccessData(data);
    } catch (err: any) {
      setReturnErrorMessage(err.message || "Gagal mengajukan retur buku.");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const resetReturnFlow = () => {
    setReturnSuccessData(null);
    setSelectedReturnOrder(null);
    setReturnLookupQuery("");
    setMatchedOrders([]);
    setReturnReason("");
    setDefectPhotoBase64("");
  };

  return {
    returnLookupQuery, setReturnLookupQuery, isLookingUpReturn, returnErrorMessage,
    matchedOrders, selectedReturnOrder, setSelectedReturnOrder,
    packageBookList, selectedDefectiveBookId, setSelectedDefectiveBookId,
    returnReason, setReturnReason, defectPhotoBase64, setDefectPhotoBase64,
    returnSuccessData, isSubmittingReturn,
    handleLookupOrderForReturn, handleSelectOrderForReturn,
    handleSubmitReturnReport, resetReturnFlow,
  };
}

export type ReturnFlowState = ReturnType<typeof useReturnFlow>;
