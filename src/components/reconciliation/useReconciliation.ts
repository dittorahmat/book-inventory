import { useCallback, useState } from "react";
import { getJson } from "../../lib/api";
import type { BranchChargeRow, ReconciliationResult } from "../../lib/reconciliation-types";

/** Hook data: satu periode + daftar kerja. Semua kegagalan jadi pesan eksplisit (§5). */
export function useReconciliation(schoolId: string | null) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<ReconciliationResult | null>(null);
  const [openCharges, setOpenCharges] = useState<BranchChargeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope = schoolId ? `schoolId=${encodeURIComponent(schoolId)}&` : "";
      const [recon, charges] = await Promise.all([
        getJson<ReconciliationResult>(`/api/reconciliation?${scope}period=${period}`, "Gagal memuat rekonsiliasi."),
        getJson<BranchChargeRow[]>(`/api/branch-charges?${scope}status=open`, "Gagal memuat daftar menunggu ongkir."),
      ]);
      if (!recon || !charges) {
        setError("Server tidak mengembalikan data rekonsiliasi.");
        return;
      }
      setSummary(recon);
      setOpenCharges(charges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rekonsiliasi.");
    } finally {
      setLoading(false);
    }
  }, [period, schoolId]);

  return { period, setPeriod, summary, openCharges, loading, error, load };
}
