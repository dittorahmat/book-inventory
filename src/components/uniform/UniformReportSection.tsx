import { useCallback, useEffect, useState } from "react";
import { Download, Printer, Search, TrendingUp, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformSalesReport, fetchUniformClaims, createUniformClaim, lockUniformClaim, downloadUniformSalesCsv,
  type UniformSalesReport, type UniformClaimRow,
} from "./uniform-admin-api";
import { UniformClaimPanel } from "./UniformClaimPanel";

interface Props {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
  logistics: boolean;
}

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-[#1877F2]";
const labelCls = "block text-[11px] font-semibold text-[#050505] mb-1";

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

export function UniformReportSection({ schools, lockedSchoolId, logistics }: Props) {
  const today = new Date();
  const [schoolId, setSchoolId] = useState(lockedSchoolId ?? "");
  const [from, setFrom] = useState(`${monthOf(today)}-01`);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [jenjang, setJenjang] = useState("");
  const [size, setSize] = useState("");
  const [gender, setGender] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("");
  const [report, setReport] = useState<UniformSalesReport | null>(null);
  const [claims, setClaims] = useState<UniformClaimRow[]>([]);
  const [claimPeriod, setClaimPeriod] = useState(monthOf(today));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Search filter inside sales report table
  const [searchTable, setSearchTable] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rep, cl] = await Promise.all([
        fetchUniformSalesReport({
          schoolId: schoolId || undefined,
          from: from || undefined,
          to: to || undefined,
          jenjang: jenjang || undefined,
          size: size.trim() || undefined,
          gender: gender || undefined,
          paymentStatus: paymentStatus || undefined,
          shipmentStatus: shipmentStatus || undefined,
        }),
        fetchUniformClaims(schoolId || undefined),
      ]);
      setReport(rep);
      setClaims(cl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan seragam.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, from, to, jenjang, size, gender, paymentStatus, shipmentStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClaim = async () => {
    if (!schoolId) {
      setError("Pilih sekolah untuk membuat klaim.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await createUniformClaim(schoolId, claimPeriod);
      setNotice("Klaim tersimpan sebagai draft.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat klaim.");
    }
  };

  const handleLock = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      await lockUniformClaim(id);
      setNotice("Klaim dikunci — angka tidak berubah retroaktif.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunci klaim.");
    }
  };

  const filteredRows = (report?.rows ?? []).filter((r) => {
    const q = searchTable.toLowerCase().trim();
    if (!q) return true;
    return (
      r.schoolName.toLowerCase().includes(q) ||
      r.jenjang.toLowerCase().includes(q) ||
      r.size.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      {/* Editorial Header Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Analytics & Klaim
            </span>
            <span className="text-xs text-[#65676B]">&bull; Rekapitulasi Seragam</span>
          </div>
          <h2 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            Laporan Penjualan & Rekapitulasi
          </h2>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Pantau pergerakan omzet seragam, kuantitas tersalurkan per ukuran/jenjang, dan penetapan klaim tagihan berkala ke sekolah cabang.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadUniformSalesCsv({ schoolId: schoolId || undefined, from: from || undefined, to: to || undefined, jenjang: jenjang || undefined, size: size.trim() || undefined, gender: gender || undefined, paymentStatus: paymentStatus || undefined, shipmentStatus: shipmentStatus || undefined })}
            className="px-3.5 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98] transition-all inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1877F2]" />
            <span>Unduh CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98] transition-all inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#65676B]" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ringkasan Eksekutif */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Pesanan", value: String(report?.totals.orderCount ?? 0), unit: "Order", color: "text-[#050505]" },
          { label: "Siswa Terlayani", value: String(report?.totals.studentCount ?? 0), unit: "Siswa", color: "text-[#050505]" },
          { label: "Item Tersalurkan", value: String(report?.totals.quantity ?? 0), unit: "Pcs", color: "text-[#050505]" },
          { label: "Total Omzet", value: formatRupiah(report?.totals.revenue ?? 0), unit: "", color: "text-[#1877F2]" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-[#E4E6EB] p-4 shadow-xs space-y-1">
            <div className="text-[11px] font-semibold text-[#65676B] flex items-center justify-between">
              <span>{c.label}</span>
              <TrendingUp className="w-3.5 h-3.5 text-[#65676B]/60" />
            </div>
            <div className={`text-lg sm:text-xl font-bold ${c.color}`}>
              {loading ? "…" : c.value} {c.unit && <span className="text-xs font-normal text-[#65676B]">{c.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Control Box */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#050505]">Filter Data Penjualan:</span>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="text-[11px] font-semibold text-[#1877F2] hover:underline inline-flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{showAdvancedFilters ? "Sembunyikan Filter Lanjutan" : "Filter Lanjutan"}</span>
            {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Primary Filters: Sekolah & Tanggal */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <SearchableSingleSelect
              label="Sekolah / Cabang"
              options={schools.map((s) => ({ value: s.id, label: s.name }))}
              value={schoolId}
              onChange={setSchoolId}
              placeholder="Semua Sekolah"
              disabled={!!lockedSchoolId}
            />
          </div>
          <div>
            <label className={labelCls}>Dari Tanggal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Advanced Collapsible Filters */}
        {showAdvancedFilters && (
          <div className="grid gap-3 sm:grid-cols-5 pt-3 border-t border-[#F0F2F5] animate-in fade-in duration-100">
            <div>
              <SearchableSingleSelect
                label="Jenjang"
                options={[
                  { value: "", label: "Semua Jenjang" },
                  { value: "tk", label: "TK" },
                  { value: "sd", label: "SD" },
                  { value: "smp", label: "SMP" },
                  { value: "sma", label: "SMA" },
                ]}
                value={jenjang}
                onChange={setJenjang}
                placeholder="Pilih jenjang..."
              />
            </div>
            <div>
              <label className={labelCls}>Ukuran (Size)</label>
              <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="M / L / —" className={inputCls} />
            </div>
            <div>
              <SearchableSingleSelect
                label="Gender Siswa"
                options={[
                  { value: "", label: "Semua" },
                  { value: "male", label: "Ikhwan" },
                  { value: "female", label: "Akhwat" },
                ]}
                value={gender}
                onChange={setGender}
                placeholder="Pilih..."
              />
            </div>
            <div>
              <SearchableSingleSelect
                label="Status Pembayaran"
                options={[
                  { value: "", label: "Semua Status" },
                  { value: "unpaid", label: "Belum bayar" },
                  { value: "partial", label: "Cicilan" },
                  { value: "paid", label: "Lunas" },
                  { value: "scholarship_pending", label: "Beasiswa" },
                ]}
                value={paymentStatus}
                onChange={setPaymentStatus}
                placeholder="Pilih..."
              />
            </div>
            <div>
              <SearchableSingleSelect
                label="Status Pengiriman"
                options={[
                  { value: "", label: "Semua Status" },
                  { value: "belum_dikirim", label: "Belum terbagi" },
                  { value: "sudah_dikirim", label: "Sudah terbagi" },
                ]}
                value={shipmentStatus}
                onChange={setShipmentStatus}
                placeholder="Pilih..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabel Rincian Penjualan Ber-Search */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F8F9FA] border-b border-[#E4E6EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Rincian Penjualan per Sekolah &times; Jenjang &times; Ukuran</h3>
            <p className="text-[11px] text-[#65676B]">{filteredRows.length} baris data ditemukan</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
            <input
              type="text"
              placeholder="Filter sekolah, jenjang, atau ukuran..."
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-[#CED0D4] rounded-xl bg-white w-full focus:outline-none focus:border-[#1877F2]"
            />
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-[#65676B]">
            {loading ? "Memuat data laporan..." : "Tidak ada catatan penjualan yang sesuai pada filter ini."}
          </div>
        ) : (
          <div className="divide-y divide-[#E4E6EB]">
            {filteredRows.map((r) => (
              <div
                key={`${r.schoolId}-${r.jenjang}-${r.size}`}
                className="px-4 py-3 text-xs flex items-center justify-between gap-3 hover:bg-[#F0F2F5]/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold text-[#050505]">
                    {r.schoolName} <span className="font-semibold text-[#65676B]">&bull; {r.jenjang.toUpperCase()} &bull; Ukuran: {r.size}</span>
                  </div>
                  <div className="text-[#65676B] mt-0.5">
                    {r.orderCount} order &bull; {r.studentCount} murid unik &bull; Total: <span className="font-semibold text-[#050505]">{r.quantity} pcs</span>
                  </div>
                </div>
                <div className="text-sm font-bold text-[#1877F2] shrink-0">{formatRupiah(r.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel Klaim ke Cabang */}
      <UniformClaimPanel
        claims={claims}
        claimPeriod={claimPeriod}
        onClaimPeriodChange={setClaimPeriod}
        onClaim={handleClaim}
        onLock={handleLock}
        logistics={logistics}
      />
    </div>
  );
}
