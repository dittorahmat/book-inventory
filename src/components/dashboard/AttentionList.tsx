import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import type { DashboardAttention } from "../../lib/dashboard-types";
import { ChartCard, ChartEmpty } from "./chart-kit";
import { formatCount } from "../../lib/transfer-pricing";

export function AttentionList({ attention, onNavigate }: { attention: DashboardAttention; onNavigate: (tab: string) => void }) {
  const items: Array<{ key: string; label: string; count: number; tab: string }> = [
    { key: "returns", label: "Retur dilaporkan", count: attention.returnsReported, tab: "returns" },
    { key: "transfers", label: "Transfer berjalan", count: attention.transfersInTransit, tab: "transfers" },
    { key: "po", label: "PO belum diterima", count: attention.poUnreceived, tab: "procurement" },
    { key: "damaged", label: "Stok rusak", count: attention.damaged, tab: "inventory" },
    { key: "lost", label: "Stok hilang", count: attention.lost, tab: "inventory" },
  ];
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <ChartCard
      title="Perlu Perhatian"
      action={
        total === 0 ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        )
      }
    >
      {total === 0 ? (
        <ChartEmpty
          message="Aman terkendali."
          hint="Tidak ada stok rusak, retur, transfer, atau PO yang menggantung."
        />
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
                <span className="ml-auto text-sm font-bold text-[#050505]">{formatCount(i.count)}</span>
                <ChevronRight className="w-4 h-4 text-[#90949C]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
