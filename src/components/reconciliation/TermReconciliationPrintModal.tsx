import { Printer } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { School } from "../../types";

interface AuditPackageRow {
  packageId: string;
  packageName: string;
  packageCode: string | null;
  targetGrade: string | null;
  unitPrice: number;
  totalInbound: number;
  totalDistributed: number;
  systemRemaining: number;
}

export interface StudentRecapItem {
  orderId: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  grade: string;
  packageName: string | null;
  status: string;
}

interface TermReconciliationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliationNumber?: string;
  school?: School;
  academicYear: string;
  term: string;
  packages: AuditPackageRow[];
  physicalCounts: Record<string, number>;
  totalInbound: number;
  totalDistributed: number;
  totalSystemRemaining: number;
  totalPhysicalRemaining: number;
  totalDiscrepancy: number;
  totalLossAmount: number;
  recapData: StudentRecapItem[];
}

export function TermReconciliationPrintModal({
  isOpen,
  onClose,
  reconciliationNumber,
  school,
  academicYear,
  term,
  packages,
  physicalCounts,
  totalInbound,
  totalDistributed,
  totalSystemRemaining,
  totalPhysicalRemaining,
  totalDiscrepancy,
  totalLossAmount,
  recapData,
}: TermReconciliationPrintModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#E4E6EB] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6EB] print:hidden">
          <h2 className="text-sm font-bold text-[#050505]">
            Pratinjau Dokumen Berita Acara Rekonsiliasi & Tagihan
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" /> Cetak / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[#CED0D4] rounded-xl text-xs text-[#050505] hover:bg-[#F0F2F5]"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs text-[#050505] print:p-0">
          {/* Header Dokumen */}
          <div className="text-center border-b pb-4">
            <h1 className="text-base font-bold uppercase">Berita Acara Rekonsiliasi Stok & Memo Tagihan</h1>
            <p className="text-xs text-[#65676B] mt-0.5">
              Nomor: <strong>{reconciliationNumber || "BA-RECON-DRAFT"}</strong> | Tanggal:{" "}
              {new Date().toLocaleDateString("id-ID")}
            </p>
            <p className="text-xs font-medium mt-1">
              Cabang: {school?.name} | Periode Ajaran: {academicYear} ({term})
            </p>
          </div>

          {/* Rangkuman Finansial & Fisik */}
          <div className="space-y-2">
            <p className="leading-relaxed">
              Pada hari ini telah dilakukan stock opname dan audit fisik penutupan periode antara Tim Logistik Pusat dan
              Cabang {school?.name}. Berikut adalah ringkasan hasil audit:
            </p>
            <table className="w-full border-collapse border border-[#CED0D4] text-xs">
              <thead className="bg-[#F0F2F5]">
                <tr>
                  <th className="border border-[#CED0D4] px-2 py-1 text-left">Paket Buku</th>
                  <th className="border border-[#CED0D4] px-2 py-1 text-center">Terkirim</th>
                  <th className="border border-[#CED0D4] px-2 py-1 text-center">Diserahkan</th>
                  <th className="border border-[#CED0D4] px-2 py-1 text-center">Sisa Sistem</th>
                  <th className="border border-[#CED0D4] px-2 py-1 text-center">Fisik Nyata</th>
                  <th className="border border-[#CED0D4] px-2 py-1 text-center">Selisih Hilang</th>
                  <th className="border border-[#CED0D4] px-2 py-1 text-right">Tagihan Cabang</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => {
                  const phys = physicalCounts[p.packageId] ?? p.systemRemaining;
                  const diff = Math.max(0, p.systemRemaining - phys);
                  return (
                    <tr key={p.packageId}>
                      <td className="border border-[#CED0D4] px-2 py-1">{p.packageName}</td>
                      <td className="border border-[#CED0D4] px-2 py-1 text-center">{p.totalInbound}</td>
                      <td className="border border-[#CED0D4] px-2 py-1 text-center">{p.totalDistributed}</td>
                      <td className="border border-[#CED0D4] px-2 py-1 text-center">{p.systemRemaining}</td>
                      <td className="border border-[#CED0D4] px-2 py-1 text-center">{phys}</td>
                      <td className="border border-[#CED0D4] px-2 py-1 text-center font-bold text-red-600">{diff}</td>
                      <td className="border border-[#CED0D4] px-2 py-1 text-right">
                        {formatRupiah(diff * p.unitPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="font-bold bg-[#F9FAFB]">
                <tr>
                  <td className="border border-[#CED0D4] px-2 py-1 text-center">TOTAL</td>
                  <td className="border border-[#CED0D4] px-2 py-1 text-center">{totalInbound}</td>
                  <td className="border border-[#CED0D4] px-2 py-1 text-center">{totalDistributed}</td>
                  <td className="border border-[#CED0D4] px-2 py-1 text-center">{totalSystemRemaining}</td>
                  <td className="border border-[#CED0D4] px-2 py-1 text-center">{totalPhysicalRemaining}</td>
                  <td className="border border-[#CED0D4] px-2 py-1 text-center text-red-600">{totalDiscrepancy}</td>
                  <td className="border border-[#CED0D4] px-2 py-1 text-right text-red-600">
                    {formatRupiah(totalLossAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Ketetapan & Instruksi Finansial */}
          <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#E4E6EB] space-y-1">
            <p className="font-semibold text-[#050505]">Ketetapan Penarikan & Penagihan:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-[#65676B]">
              <li>
                Sisa fisik sebanyak <strong>{totalPhysicalRemaining} paket</strong> ditarik kembali ke Gudang Pusat
                melalui Surat Jalan Retur Internal dan dapat dibongkar (unbundle) menjadi stok satuan.
              </li>
              <li>
                Selisih kehilangan fisik sebanyak <strong>{totalDiscrepancy} paket</strong> senilai{" "}
                <strong>{formatRupiah(totalLossAmount)}</strong> dibebankan kepada Finance Cabang {school?.name}{" "}
                berbasis harga jual resmi buku.
              </li>
            </ol>
          </div>

          {/* Tanda Tangan 3 Pihak */}
          <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
            <div>
              <p className="text-[#65676B]">Dibuat oleh,</p>
              <div className="h-16" />
              <p className="font-bold border-t border-[#CED0D4] pt-1">Tim Logistik Gudang</p>
            </div>
            <div>
              <p className="text-[#65676B]">Mengetahui,</p>
              <div className="h-16" />
              <p className="font-bold border-t border-[#CED0D4] pt-1">Kepala Cabang</p>
            </div>
            <div>
              <p className="text-[#65676B]">Menyetujui Tagihan,</p>
              <div className="h-16" />
              <p className="font-bold border-t border-[#CED0D4] pt-1">Finance Cabang</p>
            </div>
          </div>

          {/* Lampiran Rekap Penyerahan Siswa */}
          {recapData.length > 0 && (
            <div className="pt-6 border-t border-[#E4E6EB] space-y-2">
              <h3 className="font-bold text-xs uppercase">
                Lampiran: Rekapitulasi Penyerahan Buku ke Siswa ({recapData.length} transaksi)
              </h3>
              <table className="w-full border-collapse border border-[#CED0D4] text-[11px]">
                <thead className="bg-[#F0F2F5]">
                  <tr>
                    <th className="border border-[#CED0D4] px-2 py-1 text-left">No. Order</th>
                    <th className="border border-[#CED0D4] px-2 py-1 text-left">NIS / Nama Siswa</th>
                    <th className="border border-[#CED0D4] px-2 py-1 text-center">Kelas</th>
                    <th className="border border-[#CED0D4] px-2 py-1 text-left">Paket Buku</th>
                    <th className="border border-[#CED0D4] px-2 py-1 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recapData.slice(0, 30).map((r) => (
                    <tr key={r.orderId}>
                      <td className="border border-[#CED0D4] px-2 py-0.5">{r.orderNumber}</td>
                      <td className="border border-[#CED0D4] px-2 py-0.5">
                        {r.nis} - {r.studentName}
                      </td>
                      <td className="border border-[#CED0D4] px-2 py-0.5 text-center">{r.grade}</td>
                      <td className="border border-[#CED0D4] px-2 py-0.5">{r.packageName || "—"}</td>
                      <td className="border border-[#CED0D4] px-2 py-0.5 text-center text-emerald-600 font-medium">
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recapData.length > 30 && (
                <p className="text-[10px] text-[#65676B] text-center italic">
                  Menampilkan 30 dari total {recapData.length} data penyerahan siswa.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
