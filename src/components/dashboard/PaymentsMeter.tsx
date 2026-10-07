import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";

export function PaymentsMeter({ summary }: { summary: DashboardSchoolSummary }) {
  const p = summary.payments;
  const pct = Math.round(p.paidShare * 100);

  const total = p.totalOrders || 0;
  const paid = p.paidCount || 0;
  const partial = p.partialCount || 0;
  const unpaid = p.unpaidOnlyCount || 0;

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-[#050505]">Realisasi Pembayaran</div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              pct >= 80
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : pct >= 50
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {pct}% Terlunasi
          </span>
        </div>
        <div className="text-xs text-[#65676B] mt-1 mb-4">
          Status penagihan pesanan paket buku siswa
        </div>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-sm text-[#65676B]">
          Belum ada pesanan siswa untuk ditagih.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Outstanding Total Card */}
          <div className="rounded-xl bg-[#F0F2F5]/80 p-3 flex items-center justify-between">
            <span className="text-xs text-[#65676B]">Total Piutang Belum Lunas</span>
            <span className="text-sm font-black text-[#050505]">{formatRupiah(p.outstandingRp)}</span>
          </div>

          {/* Segmented Stacked Progress Bar */}
          <div>
            <div className="h-3 w-full bg-[#E4E6EB] rounded-full overflow-hidden flex">
              {paid > 0 && (
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${(paid / total) * 100}%` }}
                  title={`Lunas: ${paid}`}
                />
              )}
              {partial > 0 && (
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${(partial / total) * 100}%` }}
                  title={`Sebagian: ${partial}`}
                />
              )}
              {unpaid > 0 && (
                <div
                  className="bg-red-500 h-full transition-all"
                  style={{ width: `${(unpaid / total) * 100}%` }}
                  title={`Belum Bayar: ${unpaid}`}
                />
              )}
            </div>

            {/* Breakdown Legend with tactile rows */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-[#E4E6EB] text-center">
              <div className="p-2 rounded-lg bg-emerald-50/50">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Lunas</span>
                </div>
                <div className="text-base font-bold text-[#050505] mt-0.5">{paid}</div>
              </div>

              <div className="p-2 rounded-lg bg-amber-50/50">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-700">
                  <Clock className="w-3 h-3" />
                  <span>Sebagian</span>
                </div>
                <div className="text-base font-bold text-[#050505] mt-0.5">{partial}</div>
              </div>

              <div className="p-2 rounded-lg bg-red-50/50">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-red-700">
                  <AlertCircle className="w-3 h-3" />
                  <span>Belum</span>
                </div>
                <div className="text-base font-bold text-[#050505] mt-0.5">{unpaid}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
