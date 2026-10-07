import { ChevronRight, Clock, PackageCheck, UserCheck } from "lucide-react";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

interface StepConfig {
  key: "waiting" | "ready" | "picked";
  title: string;
  desc: string;
  icon: typeof Clock;
  bgLight: string;
  textColor: string;
  borderColor: string;
  badgeBg: string;
}

const STEPS: StepConfig[] = [
  {
    key: "waiting",
    title: "1. Menunggu",
    desc: "Perlu dirakit / alokasi",
    icon: Clock,
    bgLight: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    badgeBg: "bg-amber-500",
  },
  {
    key: "ready",
    title: "2. Siap Diambil",
    desc: "Tersedia di loket",
    icon: PackageCheck,
    bgLight: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    badgeBg: "bg-[#1877F2]",
  },
  {
    key: "picked",
    title: "3. Sudah Diambil",
    desc: "Diserahkan ke siswa",
    icon: UserCheck,
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    badgeBg: "bg-emerald-500",
  },
];

export function FunnelChart({ summary }: { summary: DashboardSchoolSummary }) {
  const total = summary.funnel.waiting + summary.funnel.ready + summary.funnel.picked;

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-[#050505]">Alur Pemenuhan Pesanan</div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
            {total} Total Pesanan
          </span>
        </div>
        <div className="text-xs text-[#65676B] mt-1 mb-4">
          {total === 0
            ? "Belum ada pesanan siswa pada periode ini."
            : "Pipeline distribusi buku dari perakitan paket hingga serah terima fisik"}
        </div>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-sm text-[#65676B]">
          Belum ada pesanan siswa pada periode ini.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STEPS.map((step, idx) => {
              const count = summary.funnel[step.key];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const Icon = step.icon;

              return (
                <div key={step.key} className="relative flex flex-col">
                  <div
                    className={`h-full rounded-xl border ${step.borderColor} ${step.bgLight} p-3.5 flex flex-col justify-between transition hover:shadow-sm`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${step.textColor}`} />
                        <span className={`text-xs font-bold ${step.textColor}`}>
                          {step.title}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#65676B]">{pct}%</span>
                    </div>

                    <div className="my-2">
                      <div className="text-2xl font-black text-[#050505]">
                        {count.toLocaleString("id-ID")}
                      </div>
                      <div className="text-[11px] text-[#65676B]">{step.desc}</div>
                    </div>

                    {/* Progress track */}
                    <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${step.badgeBg}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Visual pipeline connector on desktop */}
                  {idx < STEPS.length - 1 && (
                    <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-white border border-[#E4E6EB] items-center justify-center shadow-xs">
                      <ChevronRight className="w-3 h-3 text-[#65676B]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
