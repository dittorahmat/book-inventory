import { useState, useEffect } from "react";
import { api, postJson } from "../../lib/api";
import type { StudentRecapItem } from "./TermReconciliationPrintModal";
import type { School } from "../../types";

export interface AuditPackageRow {
  packageId: string;
  packageName: string;
  packageCode: string | null;
  targetGrade: string | null;
  unitPrice: number;
  totalInbound: number;
  totalDistributed: number;
  systemRemaining: number;
}

export interface AuditTotals {
  totalInbound: number;
  totalDistributed: number;
  totalSystemRemaining: number;
  totalPhysicalRemaining: number;
  totalDiscrepancy: number;
  totalLossAmount: number;
}

export interface UseTermReconciliationProps {
  schools: School[];
  activeSchoolId: string | null;
}

export function useTermReconciliation({ schools, activeSchoolId }: UseTermReconciliationProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    activeSchoolId || schools[0]?.id || ""
  );
  const [academicYear, setAcademicYear] = useState("2026/2027");
  const [term, setTerm] = useState("Ganjil");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<AuditPackageRow[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [savedRecon, setSavedRecon] = useState<{ id: string; reconciliationNumber: string } | null>(null);
  const [recapData, setRecapData] = useState<StudentRecapItem[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [returnSuccessNotice, setReturnSuccessNotice] = useState<string | null>(null);
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSchoolId) {
      loadAuditData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId, academicYear, term]);

  const loadAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: { packages: AuditPackageRow[] } }>(
        `/api/term-reconciliation/compile?schoolId=${selectedSchoolId}&academicYear=${encodeURIComponent(
          academicYear
        )}&term=${encodeURIComponent(term)}`
      );
      if (res?.data?.packages) {
        setPackages(res.data.packages);
        const initialPhys: Record<string, number> = {};
        for (const p of res.data.packages) {
          initialPhys[p.packageId] = p.systemRemaining;
        }
        setPhysicalCounts(initialPhys);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data audit rekonsiliasi");
    } finally {
      setLoading(false);
    }
  };

  const handlePhysicalCountChange = (packageId: string, val: number) => {
    setPhysicalCounts((prev) => ({
      ...prev,
      [packageId]: Math.max(0, val),
    }));
  };

  // Kalkulasi agregat
  let totalInbound = 0;
  let totalDistributed = 0;
  let totalSystemRemaining = 0;
  let totalPhysicalRemaining = 0;
  let totalDiscrepancy = 0;
  let totalLossAmount = 0;

  for (const p of packages) {
    const phys = physicalCounts[p.packageId] ?? p.systemRemaining;
    const diff = Math.max(0, p.systemRemaining - phys);
    totalInbound += p.totalInbound;
    totalDistributed += p.totalDistributed;
    totalSystemRemaining += p.systemRemaining;
    totalPhysicalRemaining += phys;
    totalDiscrepancy += diff;
    totalLossAmount += diff * p.unitPrice;
  }

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = packages.map((p) => ({
        itemType: "package" as const,
        packageId: p.packageId,
        totalInbound: p.totalInbound,
        totalDistributed: p.totalDistributed,
        physicalRemaining: physicalCounts[p.packageId] ?? p.systemRemaining,
        unitPrice: p.unitPrice,
      }));

      const res = await postJson<{ success: boolean; data: { id: string; reconciliationNumber: string } }>(
        "/api/term-reconciliation",
        {
          schoolId: selectedSchoolId,
          academicYear,
          term,
          items,
        }
      );
      if (res?.data) {
        setSavedRecon(res.data);
        const recapRes = await api<{ success: boolean; data: StudentRecapItem[] }>(
          `/api/term-reconciliation/recap/${selectedSchoolId}`
        );
        if (recapRes?.data) {
          setRecapData(recapRes.data);
        }
        setShowPrintModal(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan berita acara");
    } finally {
      setSaving(false);
    }
  };

  const handleReturnPhysicalRemaining = async () => {
    const returnItems = packages
      .map((p) => ({
        packageId: p.packageId,
        quantity: physicalCounts[p.packageId] ?? p.systemRemaining,
      }))
      .filter((it) => it.quantity > 0);

    if (returnItems.length === 0) {
      setError("Tidak ada sisa fisik paket untuk ditarik.");
      return;
    }

    setCreatingReturn(true);
    setError(null);
    setReturnSuccessNotice(null);

    try {
      const warehouse = schools.find((s) => s.type === "warehouse" || s.type === "main") || schools[0];
      const res = await postJson<{ success: boolean; message: string; data?: { shipmentId?: string } }>(
        "/api/internal-orders/shipments/manual",
        {
          destinationSchoolId: warehouse.id,
          deliveryNoteNumber: `SJ-RETUR-${Date.now().toString().slice(-6)}`,
          notes: `[Retur Sisa Akhir Periode] Penarikan sisa fisik dari ${selectedSchool?.name || "cabang"}`,
          items: returnItems,
        }
      );
      if (res?.success) {
        setReturnSuccessNotice(
          `Surat Jalan penarikan ${totalPhysicalRemaining} paket ke Gudang Pusat berhasil diterbitkan.`
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menerbitkan Surat Jalan penarikan sisa");
    } finally {
      setCreatingReturn(false);
    }
  };

  const totals: AuditTotals = {
    totalInbound,
    totalDistributed,
    totalSystemRemaining,
    totalPhysicalRemaining,
    totalDiscrepancy,
    totalLossAmount,
  };

  return {
    selectedSchoolId,
    setSelectedSchoolId,
    selectedSchool,
    academicYear,
    setAcademicYear,
    term,
    setTerm,
    loading,
    saving,
    packages,
    physicalCounts,
    handlePhysicalCountChange,
    savedRecon,
    recapData,
    showPrintModal,
    setShowPrintModal,
    returnSuccessNotice,
    creatingReturn,
    error,
    totals,
    totalInbound,
    totalDistributed,
    totalSystemRemaining,
    totalPhysicalRemaining,
    totalDiscrepancy,
    totalLossAmount,
    handleSaveDraft,
    handleReturnPhysicalRemaining,
  };
}
