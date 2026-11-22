import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { buildQuery, getJson, readResponseErrorMessage } from "../../lib/api";
import { BankTransferReconciliationTable } from "../reconciliation/BankTransferReconciliationTable";
import type { BankTransferReconciliationItem } from "../reconciliation/recon-transfers-types";
import type { School } from "../../types";

interface FinanceTransferReconciliationSectionProps {
  schools: School[];
  lockedSchoolId?: string | null;
}

export function FinanceTransferReconciliationSection({
  schools,
  lockedSchoolId,
}: FinanceTransferReconciliationSectionProps) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(lockedSchoolId || "all");
  const [transfers, setTransfers] = useState<BankTransferReconciliationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSchoolId = lockedSchoolId || selectedSchoolId;

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildQuery("/api/reconciliation/transfers", {
        period,
        schoolId: effectiveSchoolId !== "all" ? effectiveSchoolId : undefined,
      });
      const data = await getJson<BankTransferReconciliationItem[]>(url, "Gagal memuat rincian transfer bank.");
      setTransfers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rincian transfer bank.");
    } finally {
      setLoading(false);
    }
  }, [period, effectiveSchoolId]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const query = buildQuery("/api/reconciliation/transfers/export", {
        period,
        schoolId: effectiveSchoolId !== "all" ? effectiveSchoolId : undefined,
      });
      const res = await fetch(query);
      if (!res.ok) {
        throw new Error(await readResponseErrorMessage(res, "Gagal mengunduh file Excel rekonsiliasi."));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const schoolSuffix = effectiveSchoolId !== "all" ? `-${effectiveSchoolId}` : "-nasional";
      a.download = `rekonsiliasi-finance-${period}${schoolSuffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh file Excel rekonsiliasi.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#050505]">Filter Rekonsiliasi Transfer Bank</h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Pencocokan mutasi bank masuk dari wali murid dan pemecahan alokasi ke pesanan buku & seragam.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label htmlFor="finance-period" className="sr-only">Periode</label>
            <input
              id="finance-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value || period)}
              className="px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
          </div>

          {!lockedSchoolId && (
            <div>
              <label htmlFor="finance-school" className="sr-only">Cabang Sekolah</label>
              <select
                id="finance-school"
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              >
                <option value="all">Semua Cabang (Konsolidasi Nasional)</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={loadTransfers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-red-700">{error}</p>
        </div>
      )}

      {loading && transfers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] px-4 py-12 text-center text-xs text-[#65676B] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Memuat rincian transaksi transfer bank...</span>
        </div>
      ) : (
        <BankTransferReconciliationTable
          transfers={transfers}
          onExportExcel={handleExportExcel}
          exporting={exporting}
        />
      )}
    </div>
  );
}
