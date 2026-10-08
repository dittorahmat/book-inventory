import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { School } from "../types";
import { useDashboard } from "../components/dashboard/useDashboard";
import { ComparisonSection } from "../components/dashboard/ComparisonSection";
import { DetailSection } from "../components/dashboard/DetailSection";

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

export function DashboardView({ activeSchool, isCentralAdmin, onNavigateTab }: DashboardViewProps) {
  const [drillId, setDrillId] = useState<string | null>(null);
  const schoolId = isCentralAdmin ? drillId : activeSchool?.id ?? null;
  const { data, isLoading, error, retry } = useDashboard(schoolId);

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
              const detail = `Dashboard error ${new Date().toISOString()} :: ${error ?? "unknown"} :: schoolId=${schoolId ?? "-"}`;
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
    return <ComparisonSection summaries={data.schools} onSelectSchool={setDrillId} />;
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
      {drillId ? (
        <div>
          <button
            type="button"
            onClick={() => setDrillId(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#050505] bg-white border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] active:scale-[0.98] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Semua Sekolah
          </button>
        </div>
      ) : null}
      <DetailSection summary={summary} onNavigateTab={onNavigateTab} />
    </div>
  );
}
