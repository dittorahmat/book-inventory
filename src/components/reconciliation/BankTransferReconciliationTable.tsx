import { useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { BankTransferReconciliationItem } from "./recon-transfers-types";

interface BankTransferReconciliationTableProps {
  transfers: BankTransferReconciliationItem[];
  onExportExcel: () => void;
  exporting?: boolean;
}

export function BankTransferReconciliationTable({
  transfers,
  onExportExcel,
  exporting,
}: BankTransferReconciliationTableProps) {
  const [search, setSearch] = useState("");
  const [filterTarget, setFilterTarget] = useState<string>("");

  const filtered = transfers.filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      t.studentName.toLowerCase().includes(search.toLowerCase()) ||
      t.nis.toLowerCase().includes(search.toLowerCase()) ||
      t.schoolName.toLowerCase().includes(search.toLowerCase()) ||
      (t.referenceNumber && t.referenceNumber.toLowerCase().includes(search.toLowerCase()));

    const matchesTarget = filterTarget === "" || t.transferTarget === filterTarget;

    return matchesSearch && matchesTarget;
  });

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#050505]">Rincian Transfer Bank & Alokasi Order (Finance)</h2>
          <p className="text-xs text-[#65676B]">
            Data rekonsiliasi pembayaran per alokasi buku & seragam untuk validasi mutasi rekening.
          </p>
        </div>
        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting || transfers.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <Download className="w-3.5 h-3.5" />
          <span>Ekspor Excel (.xlsx)</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#E4E6EB]">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#65676B] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama siswa, NIS, atau sekolah..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
          >
            <option value="">Semua Tujuan (Buku & Seragam)</option>
            <option value="Buku">Buku</option>
            <option value="Seragam">Seragam</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E4E6EB]">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#F0F2F5] text-[#050505] font-semibold border-b border-[#E4E6EB]">
            <tr>
              <th className="px-3.5 py-2.5">Nama Siswa</th>
              <th className="px-3 py-2.5">NIS</th>
              <th className="px-3 py-2.5">Sekolah</th>
              <th className="px-3 py-2.5">Tgl Transfer</th>
              <th className="px-3 py-2.5 text-right">Total Transfer</th>
              <th className="px-3 py-2.5 text-right">Alokasi Transfer</th>
              <th className="px-3 py-2.5 text-center">Tujuan Transfer</th>
              <th className="px-3 py-2.5">Bank / Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#65676B]">
                  Tidak ada data transfer pada periode terpilih.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.allocationId} className="hover:bg-[#F0F2F5]/40 transition-colors">
                  <td className="px-3.5 py-2.5 font-semibold text-[#050505]">{row.studentName}</td>
                  <td className="px-3 py-2.5 font-mono text-[#65676B]">{row.nis}</td>
                  <td className="px-3 py-2.5">{row.schoolName}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#65676B]">{row.transferDate || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-[#050505]">
                    {formatRupiah(row.totalTransfer)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                    {formatRupiah(row.allocationAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.transferTarget === "Buku"
                          ? "bg-blue-100 text-[#1877F2]"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {row.transferTarget}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#65676B]">
                    <div className="font-medium text-[#050505]">{row.bankName}</div>
                    {row.referenceNumber && (
                      <div className="text-[10px] text-[#65676B]">{row.referenceNumber}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
