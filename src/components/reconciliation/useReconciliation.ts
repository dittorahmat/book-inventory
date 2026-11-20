import { useCallback, useState } from "react";
import { buildQuery, getJson } from "../../lib/api";
import type { BranchChargeRow, ReconciliationResult } from "../../lib/reconciliation-types";
import type { BankTransferReconciliationItem } from "./recon-transfers-types";

/** Hook data: satu periode + daftar kerja. Semua kegagalan jadi pesan eksplisit (§5). */
export function useReconciliation(schoolId: string | null) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<ReconciliationResult | null>(null);
  const [openCharges, setOpenCharges] = useState<BranchChargeRow[]>([]);
  const [transfers, setTransfers] = useState<BankTransferReconciliationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope = schoolId ? `schoolId=${encodeURIComponent(schoolId)}&` : "";
      const [recon, charges, transferList] = await Promise.all([
        getJson<ReconciliationResult>(`/api/reconciliation?${scope}period=${period}`, "Gagal memuat rekonsiliasi."),
        getJson<BranchChargeRow[]>(`/api/branch-charges?${scope}status=open`, "Gagal memuat daftar menunggu ongkir."),
        getJson<BankTransferReconciliationItem[]>(`/api/reconciliation/transfers?${scope}period=${period}`, "Gagal memuat daftar transfer bank."),
      ]);
      if (!recon || !charges) {
        setError("Server tidak mengembalikan data rekonsiliasi.");
        return;
      }
      setSummary(recon);
      setOpenCharges(charges);
      setTransfers(transferList || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rekonsiliasi.");
    } finally {
      setLoading(false);
    }
  }, [period, schoolId]);

  const downloadExcel = async () => {
    const query = buildQuery("/api/reconciliation/transfers/export", {
      period,
      schoolId: schoolId || undefined,
    });
    const res = await fetch(query);
    if (!res.ok) throw new Error("Gagal mengunduh file Excel rekonsiliasi.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekonsiliasi-finance-${period}${schoolId ? `-${schoolId}` : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { period, setPeriod, summary, openCharges, transfers, loading, error, load, downloadExcel };
}
