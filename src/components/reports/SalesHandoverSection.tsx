import { formatRupiah } from "../../lib/transfer-pricing";

export interface HandoverData {
  orderCount: number;
  revenue: number;
  collected: number;
  shippingTotal: number;
  bySchool: Array<{
    schoolId: string;
    schoolName: string;
    orderCount: number;
    revenue: number;
    collected: number;
    shippingTotal: number;
  }>;
}

/** Agregat buku yang sudah diserahkan cabang→ortu, untuk tagihan ke finance. */
export function SalesHandoverSection({ handover }: { handover: HandoverData }) {
  return (
    <section className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
      <header className="px-5 py-3 border-b border-[#E4E6EB]">
        <h2 className="text-sm font-bold text-[#050505]">Serah-Terima ke Ortu (Tagihan Finance)</h2>
        <p className="text-[11px] text-[#65676B] mt-0.5">
          {handover.orderCount} order · {formatRupiah(handover.revenue)} · terkumpul {formatRupiah(handover.collected)} · ongkir {formatRupiah(handover.shippingTotal)}
        </p>
      </header>
      {handover.bySchool.length === 0 ? (
        <p className="px-5 py-8 text-xs text-[#65676B] text-center">Belum ada serah-terima pada filter ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Sekolah</th>
                <th className="py-2.5 px-4 text-right">Order</th>
                <th className="py-2.5 px-4 text-right">Omzet</th>
                <th className="py-2.5 px-4 text-right">Terkumpul</th>
                <th className="py-2.5 px-4 text-right">Ongkir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {handover.bySchool.map((row) => (
                <tr key={row.schoolId} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#050505]">{row.schoolName}</td>
                  <td className="py-3 px-4 text-right">{row.orderCount}</td>
                  <td className="py-3 px-4 text-right font-semibold">{formatRupiah(row.revenue)}</td>
                  <td className="py-3 px-4 text-right text-emerald-700">{formatRupiah(row.collected)}</td>
                  <td className="py-3 px-4 text-right">{formatRupiah(row.shippingTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
