import { useState } from "react";
import type { UniformCatalog, UniformStudent } from "../../lib/uniform-types";
import type { SchoolOption } from "../../lib/portal-types";
import { postJson } from "../../lib/api";
import {
  fetchUniformSchools,
  searchUniformStudents,
  fetchUniformCatalog,
  lookupUniformOrders,
  requestUniformExchange,
  requestUniformRefund,
  getSportsExchangeTracking,
  type UniformLookupOrder,
  type UniformLookupItem,
} from "./uniform-portal-api";

export type UniformReturnStep = 1 | 2 | 3;

export function useUniformReturn() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UniformStudent[]>([]);
  const [searched, setSearched] = useState(false);
  const [student, setStudent] = useState<UniformStudent | null>(null);
  const [orders, setOrders] = useState<UniformLookupOrder[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, UniformLookupItem[]>>({});
  const [catalog, setCatalog] = useState<UniformCatalog | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [mode, setMode] = useState<"exchange" | "refund">("exchange");
  const [exItemId, setExItemId] = useState("");
  const [exNewVariant, setExNewVariant] = useState("");
  const [exNewSize, setExNewSize] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [courierResi, setCourierResi] = useState("");
  const [letterBase64, setLetterBase64] = useState("");
  const [step, setStep] = useState<UniformReturnStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [exCourierResi, setExCourierResi] = useState("");
  const [createdExchangeId, setCreatedExchangeId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Awaited<ReturnType<typeof getSportsExchangeTracking>> | null>(null);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;
  const selectedItems = selectedOrderId ? (itemsByOrder[selectedOrderId] ?? []) : [];
  const variantById = new Map((catalog?.variants ?? []).map((v) => [v.id, v]));
  const packageById = new Map((catalog?.packages ?? []).map((p) => [p.id, p]));
  const olahraga = (catalog?.variants ?? []).filter((v) => v.kind === "olahraga");

  const itemLabel = (i: UniformLookupItem) =>
    i.variantId
      ? `${variantById.get(i.variantId)?.name ?? "Satuan"} · ${i.size} ×${i.quantity}`
      : `${packageById.get(i.packageId ?? "")?.name ?? "Paket"} ×${i.quantity}`;
  const selectedItem = selectedItems.find((i) => i.id === exItemId) ?? null;

  const canSubmitExchange =
    !!selectedOrder &&
    !!selectedItem?.variantId &&
    !!exNewVariant &&
    !!exNewSize &&
    reason.trim().length > 0 &&
    exCourierResi.trim().length >= 3;
  const canSubmitRefund =
    !!selectedOrder &&
    reason.trim().length > 0 &&
    (!isWithdrawal || courierResi.trim().length >= 3);

  const loadSchools = async () => {
    try {
      setSchools(await fetchUniformSchools());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar sekolah.");
    }
  };

  const handleSearch = async () => {
    if (query.trim().length < 2 || !schoolId) {
      setError("Pilih sekolah dan ketik minimal 2 karakter nama/NIS.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setResults(await searchUniformStudents({ query, schoolId }));
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal melakukan pencarian siswa.");
    } finally {
      setSearching(false);
    }
  };

  const selectStudent = async (s: UniformStudent) => {
    setStudent(s);
    setLoadingOrders(true);
    setError(null);
    try {
      const [found, cat] = await Promise.all([
        lookupUniformOrders({ studentId: s.id, schoolId: s.schoolId }),
        fetchUniformCatalog(s.academicYear),
      ]);
      setOrders(found.orders);
      setItemsByOrder(found.itemsByOrder);
      setCatalog(cat);
      setSelectedOrderId(found.orders[0]?.id ?? "");
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pesanan murid.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const backToSearch = () => {
    setStudent(null);
    setOrders([]);
    setItemsByOrder({});
    setCatalog(null);
    setSelectedOrderId("");
    setExItemId("");
    setReason("");
    setAmount("");
    setSuccess(null);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!student || !selectedOrder) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "exchange") {
        if (!canSubmitExchange || !selectedItem?.variantId) return;
        const resp = (await requestUniformExchange({
          orderId: selectedOrder.id,
          studentId: student.id,
          oldVariantId: selectedItem.variantId,
          oldSize: selectedItem.size,
          newVariantId: exNewVariant,
          newSize: exNewSize,
          reason: reason.trim(),
          courierResi: exCourierResi.trim(),
        })) as { data?: { id?: string } };
        if (resp?.data?.id) {
          setCreatedExchangeId(resp.data.id);
          try {
            const trk = await getSportsExchangeTracking(resp.data.id);
            setTracking(trk);
          } catch {
            // Abaikan jika tracking belum siap
          }
        }
        setSuccess("Pengajuan tukar seragam olahraga terkirim — resi retur Anda tersimpan dan fisik seragam akan diverifikasi gudang.");
      } else if (isWithdrawal) {
        if (!canSubmitRefund) return;
        await postJson(
          "/api/public/uniform-orders/cancel-withdrawal",
          {
            orderId: selectedOrder.id,
            studentId: student.id,
            courierResi: courierResi.trim(),
            reason: reason.trim(),
            letterProofBase64: letterBase64 || undefined,
          },
          "Gagal mengajukan retur seragam siswa mengundurkan diri."
        );
        setSuccess("Pengajuan pembatalan & retur fisik seragam berhasil dikirim untuk review gudang.");
      } else {
        if (!canSubmitRefund) return;
        await requestUniformRefund({
          orderId: selectedOrder.id,
          studentId: student.id,
          amount: amount.trim() ? Number(amount) : undefined,
          reason: reason.trim(),
        });
        setSuccess("Pengajuan refund terkirim — gudang akan memprosesnya.");
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim pengajuan.");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    schools, schoolId, setSchoolId, query, setQuery, searching, results, searched,
    student, orders, loadingOrders, selectedOrderId, setSelectedOrderId, selectedOrder, selectedItems,
    olahraga, variantById, itemLabel, selectedItem,
    mode, setMode, exItemId, setExItemId, exNewVariant, setExNewVariant, exNewSize, setExNewSize,
    reason, setReason, amount, setAmount, step, submitting, error, setError, success,
    isWithdrawal, setIsWithdrawal, courierResi, setCourierResi, letterBase64, setLetterBase64,
    exCourierResi, setExCourierResi, createdExchangeId, tracking,
    canSubmitExchange, canSubmitRefund,
    loadSchools, handleSearch, selectStudent, backToSearch, handleSubmit,
  };
}
