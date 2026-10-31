import { FileText, AlertTriangle, Loader2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { TermReconciliationPrintModal } from "./TermReconciliationPrintModal";
import { AuditCountsTable } from "./AuditCountsTable";
import { useTermReconciliation } from "./useTermReconciliation";
import type { School } from "../../types";

interface TermReconciliationTabProps {
  schools: School[];
  activeSchoolId: string | null;
  isCentralAdmin: boolean;
}

export function TermReconciliationTab({
  schools,
  activeSchoolId,
  isCentralAdmin,
}: TermReconciliationTabProps) {
  const {
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
  } = useTermReconciliation({ schools, activeSchoolId });

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {isCentralAdmin && (
            <div>
              <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Pilih Cabang</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Tahun Ajaran</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-28 px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Semester / Term</label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalPhysicalRemaining > 0 && isCentralAdmin && (
            <button
              type="button"
              onClick={handleReturnPhysicalRemaining}
              disabled={creatingReturn || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
            >
              {creatingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Tarik Sisa ({totalPhysicalRemaining} Paket) ke Gudang
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || loading || packages.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Finalisasi & Cetak Berita Acara
          </button>
        </div>
      </div>

      {returnSuccessNotice && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
          {returnSuccessNotice}
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Total Buku Terkirim</p>
          <p className="text-lg font-bold text-[#050505] mt-0.5">{totalInbound} paket</p>
          <p className="text-[11px] text-[#65676B] mt-0.5">Diserahkan: {totalDistributed} paket</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Target Sisa di Rak</p>
          <p className="text-lg font-bold text-blue-600 mt-0.5">{totalSystemRemaining} paket</p>
          <p className="text-[11px] text-[#65676B] mt-0.5">Sisa sistem seharusnya</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Sisa Fisik Nyata (Ditarik)</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">{totalPhysicalRemaining} paket</p>
          <p className="text-[11px] text-[#65676B] mt-0.5">Masuk kembali ke Gudang</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Selisih Hilang (Ditagihkan)</p>
          <p className={`text-lg font-bold mt-0.5 ${totalDiscrepancy > 0 ? "text-red-600" : "text-[#050505]"}`}>
            {totalDiscrepancy} paket
          </p>
          <p className="text-[11px] text-red-600 font-semibold mt-0.5">
            {formatRupiah(totalLossAmount)}
          </p>
        </div>
      </div>

      {/* Table Audit Fisik */}
      <AuditCountsTable
        packages={packages}
        physicalCounts={physicalCounts}
        onPhysicalCountChange={handlePhysicalCountChange}
        loading={loading}
        selectedSchoolName={selectedSchool?.name}
        academicYear={academicYear}
        term={term}
        totals={totals}
      />

      {showPrintModal && savedRecon && (
        <TermReconciliationPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          reconciliationNumber={savedRecon.reconciliationNumber}
          school={selectedSchool}
          academicYear={academicYear}
          term={term}
          packages={packages}
          physicalCounts={physicalCounts}
          totalInbound={totalInbound}
          totalDistributed={totalDistributed}
          totalSystemRemaining={totalSystemRemaining}
          totalPhysicalRemaining={totalPhysicalRemaining}
          totalDiscrepancy={totalDiscrepancy}
          totalLossAmount={totalLossAmount}
          recapData={recapData}
        />
      )}
    </div>
  );
}
