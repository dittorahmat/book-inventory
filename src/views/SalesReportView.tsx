import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { School } from "../types";
import { formatRupiah } from "../lib/transfer-pricing";

interface ChannelBreakdown {
  orderCount: number;
  quantity: number;
  revenue: number;
  collected: number;
  outstanding: number;
}

interface SchoolRow {
  schoolId: string;
  schoolName: string;
  revenue: number;
  collected: number;
  outstanding: number;
  orderCount: number;
  packageOrderCount: number;
  looseOrderCount: number;
  scholarshipOrderCount: number;
}

interface SalesReportPayload {
  period: { from: string; to: string };
  totals: ChannelBreakdown & {
    packageOrderCount: number;
    looseOrderCount: number;
    scholarshipOrderCount: number;
    scholarshipRevenue: number;
  };
  byChannel: { package: ChannelBreakdown; loose: ChannelBreakdown };
  bySchool: SchoolRow[];
}

interface SalesReportViewProps {
  schools: School[];
  /** Terisi bila peran bukan central admin agar sekolah terkunci. */
  lockedSchoolId?: string | null;
}

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]";

function MetricTile({ label, value, tone }: { label: string; value: string; tone?: "accent" | "positive" | "warning" }) {
  const toneClass =
    tone === "accent"
      ? "text-[#1877F2]"
      : tone === "positive"
        ? "text-emerald-600"
        : tone === "warning"
          ? "text-amber-600"
          : "text-[#050505]";
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#65676B]">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</p>
    </div>
  );
}

/** Laporan penjualan per periode, sekolah, dan tipe paket-vs-satuan (spec: sales-report). */
export function SalesReportView({ schools, lockedSchoolId }: SalesReportViewProps) {
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);
  const [schoolId, setSchoolId] = useState("");
  const [report, setReport] = useState<SalesReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocked = !!lockedSchoolId;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (schoolId) params.set("schoolId", schoolId);
      const res = await fetch(`/api/sales-report?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memuat laporan penjualan.");
      }
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan penjualan.");
    } finally {
      setIsLoading(false);
    }
  }, [from, to, schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadCsv = () => {
    const params = new URLSearchParams({ from, to });
    if (schoolId) params.set("schoolId", schoolId);
    window.location.href = `/api/sales-report/csv?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#050505] tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#1877F2]" />
              Laporan Penjualan
            </h1>
            <p className="text-xs text-[#65676B] mt-0.5">
              Rekap omzet, penerimaan, dan piutang per periode — dipisah paket vs satuan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              title="Muat ulang"
              className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#65676B]" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-[#E4E6EB]">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Dari Tanggal</label>
            <input type="date" className={`${inputClass} w-full`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Sampai Tanggal</label>
            <input type="date" className={`${inputClass} w-full`} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Sekolah</label>
            {isLocked ? (
              <div className={`${inputClass} bg-[#F0F2F5] text-[#65676B]`}>
                {schools.find((s) => s.id === lockedSchoolId)?.name ?? "Sekolah Anda"}
              </div>
            ) : (
              <select className={`${inputClass} w-full`} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">Semua Sekolah</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 inline-flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      {isLoading && !report ? (
        <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#65676B]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Menghitung laporan...</span>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricTile label="Omzet" value={formatRupiah(report.totals.revenue)} tone="accent" />
            <MetricTile label="Terkumpul" value={formatRupiah(report.totals.collected)} tone="positive" />
            <MetricTile label="Piutang" value={formatRupiah(report.totals.outstanding)} tone="warning" />
            <MetricTile label="Total Order" value={String(report.totals.orderCount)} />
            <MetricTile label="Penerima Beasiswa" value={String(report.totals.scholarshipOrderCount)} />
          </div>

          <section className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
            <header className="px-5 py-3 border-b border-[#E4E6EB]">
              <h2 className="text-sm font-bold text-[#050505]">Paket vs Satuan</h2>
            </header>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Kanal</th>
                  <th className="py-2.5 px-4 text-right">Order</th>
                  <th className="py-2.5 px-4 text-right">Kuantitas</th>
                  <th className="py-2.5 px-4 text-right">Omzet</th>
                  <th className="py-2.5 px-4 text-right">Terkumpul</th>
                  <th className="py-2.5 px-4 text-right">Piutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6EB]">
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#050505]">Paket</td>
                  <td className="py-3 px-4 text-right">{report.byChannel.package.orderCount}</td>
                  <td className="py-3 px-4 text-right">{report.byChannel.package.quantity}</td>
                  <td className="py-3 px-4 text-right font-semibold">{formatRupiah(report.byChannel.package.revenue)}</td>
                  <td className="py-3 px-4 text-right">{formatRupiah(report.byChannel.package.collected)}</td>
                  <td className="py-3 px-4 text-right">{formatRupiah(report.byChannel.package.outstanding)}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#050505]">Satuan</td>
                  <td className="py-3 px-4 text-right">{report.byChannel.loose.orderCount}</td>
                  <td className="py-3 px-4 text-right">{report.byChannel.loose.quantity}</td>
                  <td className="py-3 px-4 text-right font-semibold">{formatRupiah(report.byChannel.loose.revenue)}</td>
                  <td className="py-3 px-4 text-right">{formatRupiah(report.byChannel.loose.collected)}</td>
                  <td className="py-3 px-4 text-right">{formatRupiah(report.byChannel.loose.outstanding)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
            <header className="px-5 py-3 border-b border-[#E4E6EB]">
              <h2 className="text-sm font-bold text-[#050505]">Rincian per Sekolah</h2>
            </header>
            {report.bySchool.length === 0 ? (
              <p className="px-5 py-8 text-xs text-[#65676B] text-center">
                Tidak ada penjualan pada periode {report.period.from} sampai {report.period.to}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Sekolah</th>
                      <th className="py-2.5 px-4 text-right">Paket</th>
                      <th className="py-2.5 px-4 text-right">Satuan</th>
                      <th className="py-2.5 px-4 text-right">Beasiswa</th>
                      <th className="py-2.5 px-4 text-right">Omzet</th>
                      <th className="py-2.5 px-4 text-right">Terkumpul</th>
                      <th className="py-2.5 px-4 text-right">Piutang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E6EB]">
                    {report.bySchool.map((row) => (
                      <tr key={row.schoolId} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#050505]">{row.schoolName}</td>
                        <td className="py-3 px-4 text-right">{row.packageOrderCount}</td>
                        <td className="py-3 px-4 text-right">{row.looseOrderCount}</td>
                        <td className="py-3 px-4 text-right">{row.scholarshipOrderCount}</td>
                        <td className="py-3 px-4 text-right font-semibold">{formatRupiah(row.revenue)}</td>
                        <td className="py-3 px-4 text-right text-emerald-700">{formatRupiah(row.collected)}</td>
                        <td className="py-3 px-4 text-right text-amber-700">{formatRupiah(row.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#F7F8FA] border-t border-[#CED0D4] font-bold text-[#050505]">
                      <td className="py-3 px-4">TOTAL</td>
                      <td className="py-3 px-4 text-right">{report.totals.packageOrderCount}</td>
                      <td className="py-3 px-4 text-right">{report.totals.looseOrderCount}</td>
                      <td className="py-3 px-4 text-right">{report.totals.scholarshipOrderCount}</td>
                      <td className="py-3 px-4 text-right">{formatRupiah(report.totals.revenue)}</td>
                      <td className="py-3 px-4 text-right">{formatRupiah(report.totals.collected)}</td>
                      <td className="py-3 px-4 text-right">{formatRupiah(report.totals.outstanding)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
