import { formatRupiah } from "../../lib/transfer-pricing";
import type { AuditPackageRow, AuditTotals } from "./useTermReconciliation";

interface AuditCountsTableProps {
  packages: AuditPackageRow[];
  physicalCounts: Record<string, number>;
  onPhysicalCountChange: (packageId: string, val: number) => void;
  loading: boolean;
  selectedSchoolName?: string;
  academicYear: string;
  term: string;
  totals: AuditTotals;
}

export function AuditCountsTable({
  packages,
  physicalCounts,
  onPhysicalCountChange,
  loading,
  selectedSchoolName,
  academicYear,
  term,
  totals,
}: AuditCountsTableProps) {
  const {
    totalInbound,
    totalDistributed,
    totalSystemRemaining,
    totalPhysicalRemaining,
    totalDiscrepancy,
    totalLossAmount,
  } = totals;
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <div className="p-3 bg-[#F0F2F5] border-b border-[#E4E6EB] flex justify-between items-center">
        <span className="text-xs font-bold text-[#050505]">Rincian Audit Stok Fisik per Paket</span>
        <span className="text-xs text-[#65676B]">
          {selectedSchoolName} ({academicYear} - {term})
        </span>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-[#65676B] flex items-center justify-center gap-2">
          Mengompilasi data inbound & serah terima…
        </div>
      ) : packages.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#65676B]">
          Tidak ada data paket atau pengiriman pada cabang dan periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F0F2F5] text-[#65676B] font-semibold border-b border-[#E4E6EB]">
              <tr>
                <th className="p-3">Nama Paket</th>
                <th className="p-3 text-center">Kelas</th>
                <th className="p-3 text-right">Harga Satuan</th>
                <th className="p-3 text-center">Inbound (SJ)</th>
                <th className="p-3 text-center">Diserahkan</th>
                <th className="p-3 text-center bg-blue-50/50">Target Sisa</th>
                <th className="p-3 text-center bg-emerald-50/50">Fisik Nyata</th>
                <th className="p-3 text-center">Selisih</th>
                <th className="p-3 text-right">Nilai Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB] text-[#050505]">
              {packages.map((pkg) => {
                const phys = physicalCounts[pkg.packageId] ?? pkg.systemRemaining;
                const diff = Math.max(0, pkg.systemRemaining - phys);
                const loss = diff * pkg.unitPrice;

                return (
                  <tr key={pkg.packageId} className="hover:bg-[#F2F3F5]">
                    <td className="p-3">
                      <div className="font-semibold">{pkg.packageName}</div>
                      <div className="text-[10px] text-[#65676B]">{pkg.packageCode || "-"}</div>
                    </td>
                    <td className="p-3 text-center text-[#65676B]">{pkg.targetGrade || "-"}</td>
                    <td className="p-3 text-right">{formatRupiah(pkg.unitPrice)}</td>
                    <td className="p-3 text-center font-medium">{pkg.totalInbound}</td>
                    <td className="p-3 text-center font-medium">{pkg.totalDistributed}</td>
                    <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/20">
                      {pkg.systemRemaining}
                    </td>
                    <td className="p-3 text-center bg-emerald-50/20">
                      <input
                        type="number"
                        min="0"
                        value={phys}
                        onChange={(e) => onPhysicalCountChange(pkg.packageId, parseInt(e.target.value, 10) || 0)}
                        className="w-16 px-2 py-1 text-center font-bold text-emerald-700 bg-white border border-[#CED0D4] rounded-lg focus:border-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                          diff > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {diff > 0 ? `-${diff}` : "0 (Pas)"}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-red-600">
                      {diff > 0 ? formatRupiah(loss) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#F0F2F5] font-bold text-xs text-[#050505] border-t border-[#E4E6EB]">
              <tr>
                <td colSpan={3} className="p-3 text-right">
                  TOTAL REKONSILIASI
                </td>
                <td className="p-3 text-center">{totalInbound}</td>
                <td className="p-3 text-center">{totalDistributed}</td>
                <td className="p-3 text-center text-blue-600">{totalSystemRemaining}</td>
                <td className="p-3 text-center text-emerald-600">{totalPhysicalRemaining}</td>
                <td className="p-3 text-center text-red-600">
                  {totalDiscrepancy > 0 ? `-${totalDiscrepancy}` : 0}
                </td>
                <td className="p-3 text-right text-red-600">{formatRupiah(totalLossAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
