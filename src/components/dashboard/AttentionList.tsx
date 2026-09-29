import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

export function AttentionList({ summary, onNavigate }: { summary: DashboardSchoolSummary; onNavigate: (tab: string) => void }) {
  const a = summary.attention;
  const items: Array<{ key: string; label: string; count: number; tab: string }> = [
    { key: "returns", label: "Retur dilaporkan", count: a.returnsReported, tab: "returns" },
    { key: "transfers", label: "Transfer berjalan", count: a.transfersInTransit, tab: "transfers" },
    { key: "po", label: "PO belum diterima", count: a.poUnreceived, tab: "procurement" },
    { key: "damaged", label: "Stok rusak", count: a.damaged, tab: "inventory" },
    { key: "lost", label: "Stok hilang", count: a.lost, tab: "inventory" },
  ];
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        {total === 0 ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        )}
        <div className="text-sm font-bold text-[#050505]">Perlu Perhatian</div>
      </div>
      {total === 0 ? (
        <div className="px-5 pb-5 text-sm text-[#65676B]">Aman terkendali. Tidak ada stok rusak, retur, transfer, atau PO yang menggantung.</div>
      ) : (
        <ul className="divide-y divide-[#E4E6EB] border-t border-[#E4E6EB]">
          {items.filter((i) => i.count > 0).map((i) => (
            <li key={i.key}>
              <button
                type="button"
                onClick={() => onNavigate(i.tab)}
                className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-[#F0F2F5] active:scale-[0.98] transition"
              >
                <span className="text-sm text-[#050505] font-medium">{i.label}</span>
                <span className="ml-auto text-sm font-bold text-[#050505]">{i.count}</span>
                <ChevronRight className="w-4 h-4 text-[#90949C]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
