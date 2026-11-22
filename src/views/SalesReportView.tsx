import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, Printer, RefreshCw, Loader2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { School } from "../types";
import { buildQuery, getJson } from "../lib/api";
import { SalesReportFilters } from "../components/reports/SalesReportFilters";
import { SalesReportSummaryContent, type SalesReportSummaryPayload } from "../components/reports/SalesReportSummaryContent";
import { FinanceTransferReconciliationSection } from "../components/reports/FinanceTransferReconciliationSection";

interface SalesReportViewProps {
  schools: School[];
  /** Terisi bila peran bukan central admin agar sekolah terkunci. */
  lockedSchoolId?: string | null;
}

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Laporan penjualan & konsolidasi rekonsiliasi transfer finance (spec: sales-report & ADR 0026). */
export function SalesReportView({ schools, lockedSchoolId }: SalesReportViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"sales_summary" | "finance_reconciliation">("sales_summary");
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);
  const [schoolId, setSchoolId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [gender, setGender] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [report, setReport] = useState<SalesReportSummaryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(
        await getJson<SalesReportSummaryPayload>(
          buildQuery("/api/sales-report", {
            from,
            to,
            schoolId: schoolId || undefined,
            gradeLevel: gradeLevel.trim() || undefined,
            gender: gender || undefined,
            paymentStatus: paymentStatus || undefined,
            fulfillmentStatus: fulfillmentStatus || undefined,
          }),
          "Gagal memuat laporan penjualan."
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan penjualan.");
    } finally {
      setIsLoading(false);
    }
  }, [from, to, schoolId, gradeLevel, gender, paymentStatus, fulfillmentStatus]);

  useEffect(() => {
    if (activeSubTab === "sales_summary") {
      load();
    }
  }, [load, activeSubTab]);

  const downloadCsv = () => {
    const params = new URLSearchParams({ from, to });
    if (schoolId) params.set("schoolId", schoolId);
    if (gradeLevel.trim()) params.set("gradeLevel", gradeLevel.trim());
    if (gender) params.set("gender", gender);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (fulfillmentStatus) params.set("fulfillmentStatus", fulfillmentStatus);
    window.location.href = `/api/sales-report/csv?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Sub-Navigasi Tab Laporan */}
      <div className="flex border-b border-[#E4E6EB] gap-4">
        <button
          type="button"
          onClick={() => setActiveSubTab("sales_summary")}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 inline-flex items-center gap-1.5 ${
            activeSubTab === "sales_summary"
              ? "border-[#1877F2] text-[#1877F2]"
              : "border-transparent text-[#65676B] hover:text-[#050505]"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Ringkasan Penjualan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("finance_reconciliation")}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 inline-flex items-center gap-1.5 ${
            activeSubTab === "finance_reconciliation"
              ? "border-[#1877F2] text-[#1877F2]"
              : "border-transparent text-[#65676B] hover:text-[#050505]"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Rekonsiliasi Transfer Bank (Finance)</span>
        </button>
      </div>

      {activeSubTab === "finance_reconciliation" ? (
        <FinanceTransferReconciliationSection
          schools={schools}
          lockedSchoolId={lockedSchoolId}
        />
      ) : (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-[#050505] tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#1877F2]" />
                  Laporan Penjualan
                </h1>
                <p className="text-xs text-[#65676B] mt-0.5">
                  Rekap omzet, penerimaan, dan piutang per periode — per cabang, per program, per kategori buku.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={load}
                  title="Muat ulang"
                  className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={isLoading}
                  className="px-3.5 py-2 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-[#65676B]" />
                  <span>Unduh CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors inline-flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#65676B]" />
                  <span>Cetak / PDF</span>
                </button>
              </div>
            </div>

            <SalesReportFilters
              from={from} setFrom={setFrom}
              to={to} setTo={setTo}
              schoolId={schoolId} setSchoolId={setSchoolId}
              schools={schools} lockedSchoolId={lockedSchoolId}
              gradeLevel={gradeLevel} setGradeLevel={setGradeLevel}
              gender={gender} setGender={setGender}
              paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus}
              fulfillmentStatus={fulfillmentStatus} setFulfillmentStatus={setFulfillmentStatus}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </p>
          )}

          {isLoading && !report ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#65676B]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menghitung laporan...</span>
            </div>
          ) : report ? (
            <SalesReportSummaryContent report={report} />
          ) : null}
        </div>
      )}
    </div>
  );
}
