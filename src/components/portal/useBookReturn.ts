import { useEffect, useState } from "react";
import { fetchBookChoices, lookupReturnableOrders, submitReturnReport } from "./portal-api";
import type { PortalBookChoice, PortalOrderLookup } from "../../lib/portal-types";

/** Ambang minimum pencarian: sama dengan batas server (`lookup-order`). */
export const BOOK_RETURN_MIN_QUERY = 3;
export const BOOK_RETURN_MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MIN_REASON_CHARS = 5;

type SubmitSuccess = { returnId: string; orderNumber: string };

/**
 * State alur refund buku publik: pencarian pesanan → pilih judul + alasan +
 * foto → kirim. Hanya pesanan berstatus `picked_up` yang boleh diajukan;
 * sisanya tetap tampil dengan alasan agar ortu tahu kenapa belum bisa.
 */
export function useBookReturn() {
  const [schoolId, setSchoolId] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<PortalOrderLookup[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PortalOrderLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bookChoices, setBookChoices] = useState<PortalBookChoice[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [reason, setReason] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearched(false);
    if (!schoolId) {
      setError("Pilih cabang / sekolah terlebih dahulu.");
      return;
    }
    if (query.trim().length < BOOK_RETURN_MIN_QUERY) {
      setError(`Masukkan minimal ${BOOK_RETURN_MIN_QUERY} karakter NIS, nama, atau nomor pesanan.`);
      return;
    }
    setSearching(true);
    try {
      setOrders(await lookupReturnableOrders(query, schoolId));
      setSearched(true);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Gagal mencari pesanan.");
    } finally {
      setSearching(false);
    }
  };

  const selectOrder = (order: PortalOrderLookup) => {
    setSelectedOrder(order);
    setSelectedBookId("");
    setReason("");
    setPhotoBase64("");
    setError(null);
  };

  useEffect(() => {
    if (!selectedOrder) return;
    let cancelled = false;
    setBooksLoading(true);
    setBooksError(null);
    fetchBookChoices()
      .then((list) => {
        if (!cancelled) setBookChoices(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setBooksError(err instanceof Error ? err.message : "Gagal memuat daftar buku.");
      })
      .finally(() => {
        if (!cancelled) setBooksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrder]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Berkas bukti harus berupa gambar (JPG/PNG).");
      return;
    }
    if (file.size > BOOK_RETURN_MAX_PHOTO_BYTES) {
      setError("Ukuran foto maksimal 2 MB. Kompres atau pilih foto lain.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoBase64(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("Gagal membaca berkas foto. Silakan pilih ulang.");
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || submitting) return;
    if (!selectedBookId) {
      setError("Pilih judul buku yang dikembalikan.");
      return;
    }
    if (reason.trim().length < MIN_REASON_CHARS) {
      setError(`Alasan pengembalian minimal ${MIN_REASON_CHARS} karakter.`);
      return;
    }
    if (!photoBase64) {
      setError("Foto kondisi fisik buku wajib diunggah sebagai bukti.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitReturnReport({
        orderId: selectedOrder.id,
        studentId: selectedOrder.studentId,
        defectiveBookId: selectedBookId,
        reason: reason.trim(),
        photoProofBase64: photoBase64,
      });
      setSuccess({ returnId: result.returnId, orderNumber: result.orderNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirimkan pengajuan refund buku.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelectedOrder(null);
    setQuery("");
    setOrders([]);
    setSearched(false);
    setError(null);
    setBookChoices([]);
    setSelectedBookId("");
    setReason("");
    setPhotoBase64("");
    setSuccess(null);
  };

  return {
    schoolId,
    setSchoolId,
    query,
    setQuery,
    searching,
    searched,
    orders,
    selectedOrder,
    setSelectedOrder,
    selectOrder,
    error,
    setError,
    handleSearch,
    bookChoices,
    booksLoading,
    booksError,
    selectedBookId,
    setSelectedBookId,
    reason,
    setReason,
    photoBase64,
    handlePhoto,
    submitting,
    success,
    submit,
    reset,
  };
}
