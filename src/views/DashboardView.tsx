import { useState } from "react";
import { ArrowLeft, BarChart3, Boxes, Calendar, CircleDollarSign, GraduationCap, PackageSearch, RefreshCw } from "lucide-react";
import type { School } from "../types";
import { formatRupiah } from "../lib/transfer-pricing";
import { useDashboard } from "../components/dashboard/useDashboard";
import { useExecutiveDashboard } from "../components/dashboard/useExecutiveDashboard";
import { ComparisonSection } from "../components/dashboard/ComparisonSection";
import { DetailSection } from "../components/dashboard/DetailSection";
import { ExecutiveKpiCard } from "../components/dashboard/ExecutiveKpiCard";
import { CashBreakdownDrawer } from "../components/dashboard/CashBreakdownDrawer";
import { OrderBreakdownDrawer } from "../components/dashboard/OrderBreakdownDrawer";
import { StudentBreakdownDrawer } from "../components/dashboard/StudentBreakdownDrawer";

interface DashboardViewProps {
  activeSchool: School | null;
  isCentralAdmin: boolean;
  onNavigateTab: (tab: string) => void;
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Memuat dashboard">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`bg-white rounded-2xl border border-[#E4E6EB] p-5 ${i === 0 ? "md:col-span-2" : ""}`}>
          <div className="h-4 w-32 rounded bg-[#F0F2F5] animate-pulse" />
          <div className="mt-3 h-8 w-24 rounded bg-[#F0F2F5] animate-pulse" />
          <div className="mt-3 h-2 rounded-full bg-[#F0F2F5] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ExecutiveDashboard({
  onSelectSchool: _onSelectSchool,
}: {
  onSelectSchool: (id: string) => void;
}) {
  const {
    data,
    isLoading,
    error,
    academicYear,
    compareAcademicYear,
    enableCompare,
    setAcademicYear,
    setCompareAcademicYear,
    toggleCompare,
    retry,
  } = useExecutiveDashboard();

  const [activeDrawer, setActiveDrawer] = useState<"cash" | "orders" | "students" | "stock" | "po" | null>(null);

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center">
        <div className="text-sm font-semibold text-[#050505]">Dashboard Eksekutif gagal dimuat</div>
        <div className="mt-1 text-sm text-[#65676B]">{error ?? "Terjadi kesalahan tak terduga."}</div>
        <button
          type="button"
          onClick={retry}
          className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-[#1877F2] rounded-xl hover:bg-[#1664D9] transition"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const { kpis, breakdowns } = data;

  return (
    <div className="space-y-6">
      {/* Header Eksekutif & Filter Tahun Ajaran */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1877F2]/10 text-[#1877F2]">
              Konsolidasi Nasional
            </span>
            <span className="text-xs text-[#65676B] font-medium">Presdir & Head Office View</span>
          </div>
          <h1 className="text-xl font-black text-[#050505] mt-1">Ringkasan Eksekutif Grup</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector Tahun Ajaran Aktif */}
          <div className="flex items-center gap-2 bg-[#F0F2F5] px-3 py-1.5 rounded-xl border border-[#E4E6EB]">
            <Calendar className="w-4 h-4 text-[#65676B]" />
            <span className="text-xs font-semibold text-[#65676B]">TA:</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#050505] focus:outline-none cursor-pointer"
            >
              {data.availableAcademicYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Bandingkan Periode Lalu */}
          <div className="flex items-center gap-2 bg-[#F0F2F5] px-3 py-1.5 rounded-xl border border-[#E4E6EB]">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#050505]">
              <input
                type="checkbox"
                checked={enableCompare}
                onChange={(e) => toggleCompare(e.target.checked)}
                className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-0 cursor-pointer"
              />
              Bandingkan Periode Lalu
            </label>
            {enableCompare && (
              <select
                value={compareAcademicYear || ""}
                onChange={(e) => setCompareAcademicYear(e.target.value)}
                className="ml-2 bg-transparent text-xs font-bold text-[#1877F2] focus:outline-none cursor-pointer"
              >
                {data.availableAcademicYears
                  .filter((y) => y !== academicYear)
                  .map((y) => (
                    <option key={y} value={y}>
                      vs {y}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={retry}
            aria-label="Refresh data"
            className="p-2 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5 Kartu KPI Eksekutif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ExecutiveKpiCard
          title="Cash Related (Realized)"
          metric={kpis.cash.realizedRp}
          isCurrency
          subLabel={`Piutang: ${formatRupiah(kpis.cash.outstandingRp.current)}`}
          icon={<CircleDollarSign className="w-5 h-5" />}
          onClick={() => setActiveDrawer("cash")}
        />
        <ExecutiveKpiCard
          title="Total Ordered (GMV)"
          metric={kpis.orders.gmvRp}
          isCurrency
          subLabel={`${kpis.orders.totalOrders.current} pesanan siswa`}
          icon={<BarChart3 className="w-5 h-5" />}
          onClick={() => setActiveDrawer("orders")}
        />
        <ExecutiveKpiCard
          title="Populasi Siswa"
          metric={kpis.students.totalStudents}
          subLabel={`Adopsi: ${kpis.students.adoptionRate.current}%`}
          icon={<GraduationCap className="w-5 h-5" />}
          onClick={() => setActiveDrawer("students")}
        />
        <ExecutiveKpiCard
          title="Valuasi Stok"
          metric={kpis.stockMovement.totalValuationRp}
          isCurrency
          subLabel={`Susut/Opname: ${kpis.stockMovement.adjustmentUnits.current} unit`}
          icon={<Boxes className="w-5 h-5" />}
          onClick={() => setActiveDrawer("stock")}
        />
        <ExecutiveKpiCard
          title="Komitmen PO"
          metric={kpis.po.commitmentRp}
          isCurrency
          subLabel={`${kpis.po.totalPoCount.current} dokumen PO`}
          icon={<PackageSearch className="w-5 h-5" />}
          onClick={() => setActiveDrawer("po")}
        />
      </div>

      {/* Cash Breakdown Drawer */}
      <CashBreakdownDrawer
        isOpen={activeDrawer === "cash"}
        onClose={() => setActiveDrawer(null)}
        data={breakdowns.cash}
        academicYear={academicYear}
      />

      {/* Order Breakdown Drawer */}
      <OrderBreakdownDrawer
        isOpen={activeDrawer === "orders"}
        onClose={() => setActiveDrawer(null)}
        data={breakdowns.orders}
        academicYear={academicYear}
      />

      {/* Student Breakdown Drawer */}
      <StudentBreakdownDrawer
        isOpen={activeDrawer === "students"}
        onClose={() => setActiveDrawer(null)}
        data={breakdowns.students}
        academicYear={academicYear}
      />

      {/* Placeholder info drawer lainnya */}
      {activeDrawer && activeDrawer !== "cash" && activeDrawer !== "orders" && activeDrawer !== "students" && (
        <div className="bg-white rounded-2xl border border-[#1877F2] p-5 shadow-sm flex items-center justify-between">
          <div className="text-sm font-semibold text-[#050505]">
            Mode Breakdown: <span className="capitalize text-[#1877F2] font-black">{activeDrawer}</span> ({breakdowns[activeDrawer]?.length || 0} cabang terdata)
          </div>
          <button
            type="button"
            onClick={() => setActiveDrawer(null)}
            className="text-xs font-bold text-[#65676B] hover:text-[#050505] px-3 py-1 bg-[#F0F2F5] rounded-lg cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}
    </div>
  );
}

export function DashboardView({ activeSchool, isCentralAdmin, onNavigateTab }: DashboardViewProps) {
  const [drillId, setDrillId] = useState<string | null>(null);
  const schoolId = isCentralAdmin ? drillId : activeSchool?.id ?? null;
  const attemptedMode = !isCentralAdmin || drillId ? "detail" : "comparison";
  const { data, isLoading, error, retry } = useDashboard(schoolId);

  // Jika akun adalah central_admin dan belum memilih cabang tertentu, tampilkan Presdir Executive Dashboard
  if (isCentralAdmin && !drillId) {
    return <ExecutiveDashboard onSelectSchool={setDrillId} />;
  }

  if (!isCentralAdmin && !activeSchool) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center text-sm text-[#65676B]">
        Belum ada sekolah yang ditetapkan untuk akun ini. Hubungi admin pusat.
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center">
        <div className="text-sm font-semibold text-[#050505]">Dashboard gagal dimuat</div>
        <div className="mt-1 text-sm text-[#65676B]">{error ?? "Terjadi kesalahan tak terduga."}</div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={retry}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1877F2] rounded-xl hover:bg-[#1664D9] active:scale-[0.98] transition"
          >
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={() => {
              const detail = `Dashboard error ${new Date().toISOString()} :: ${error ?? "unknown"} :: mode=${attemptedMode} schoolId=${schoolId ?? "-"}`;
              if (navigator.clipboard) navigator.clipboard.writeText(detail).catch(() => {});
            }}
            className="px-4 py-2 text-sm font-semibold text-[#050505] bg-white border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] active:scale-[0.98] transition"
          >
            Salin Detail
          </button>
        </div>
      </div>
    );
  }

  if (data.mode === "comparison" && !drillId) {
    return <ComparisonSection summaries={data.schools} total={data.total} onSelectSchool={setDrillId} />;
  }

  const summary = drillId ? data.schools.find((s) => s.school.id === drillId) ?? data.schools[0] : data.schools[0];
  if (!summary) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center text-sm text-[#65676B]">
        Belum ada data sekolah untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {drillId && isCentralAdmin && (
        <button
          type="button"
          onClick={() => setDrillId(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1877F2] hover:underline self-start cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Ringkasan Eksekutif
        </button>
      )}
      <DetailSection summary={summary} onNavigateTab={onNavigateTab} />
    </div>
  );
}
