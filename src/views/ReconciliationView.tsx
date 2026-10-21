import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useReconciliation } from "../components/reconciliation/useReconciliation";
import { ReconciliationSummary } from "../components/reconciliation/ReconciliationSummary";
import { PendingShippingList } from "../components/reconciliation/PendingShippingList";
import { TermReconciliationTab } from "../components/reconciliation/TermReconciliationTab";
import type { School } from "../types";

interface ReconciliationViewProps {
  activeSchool: School | null;
  schools?: School[];
  isCentralAdmin: boolean;
}

export function ReconciliationView({ activeSchool, schools = [], isCentralAdmin }: ReconciliationViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"finance" | "term_stock">("finance");
  const recon = useReconciliation(isCentralAdmin ? null : activeSchool?.id ?? null);

  useEffect(() => {
    recon.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recon.period, activeSchool?.id]);

  return (
    <div className="space-y-4">
      {/* Tab Navigasi Sub-Modul */}
      <div className="flex border-b border-[#E4E6EB] gap-4">
        <button
          type="button"
          onClick={() => setActiveSubTab("finance")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeSubTab === "finance"
              ? "border-[#1877F2] text-[#1877F2]"
              : "border-transparent text-[#65676B] hover:text-[#050505]"
          }`}
        >
          Rekonsiliasi Finansial & Klaim
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("term_stock")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeSubTab === "term_stock"
              ? "border-[#1877F2] text-[#1877F2]"
              : "border-transparent text-[#65676B] hover:text-[#050505]"
          }`}
        >
          Audit Akhir Periode & Tagihan Hilang
        </button>
      </div>

      {activeSubTab === "term_stock" ? (
        <TermReconciliationTab
          schools={schools}
          activeSchoolId={activeSchool?.id ?? null}
          isCentralAdmin={isCentralAdmin}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#050505]">Rekonsiliasi</h1>
              <p className="text-xs text-[#65676B] mt-0.5">
                Uang masuk dari wali, tagihan gudang ke cabang, dan klaim periode terpilih.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="recon-period" className="block text-xs font-semibold text-[#050505] mb-1">
                  Periode
                </label>
                <input
                  id="recon-period"
                  type="month"
                  value={recon.period}
                  onChange={(e) => recon.setPeriod(e.target.value || recon.period)}
                  className="px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                />
              </div>
              <button
                type="button"
                onClick={() => recon.load()}
                disabled={recon.loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-60"
              >
                {recon.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Muat ulang
              </button>
            </div>
          </div>

          {recon.error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-red-700">{recon.error}</p>
            </div>
          )}

          {recon.loading && !recon.summary ? (
            <div className="bg-white rounded-2xl border border-[#E4E6EB] px-4 py-10 text-center text-xs text-[#65676B]">
              Memuat rekonsiliasi…
            </div>
          ) : recon.summary ? (
            <ReconciliationSummary data={recon.summary} />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E4E6EB] px-4 py-8 text-center">
              <p className="text-sm font-semibold text-[#050505]">Belum ada data periode ini</p>
              <p className="text-xs text-[#65676B] mt-1">Pilih periode lain, lalu muat ulang.</p>
            </div>
          )}

          <PendingShippingList charges={recon.openCharges} />
        </>
      )}
    </div>
  );
}
