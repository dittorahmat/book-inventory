import { useCallback, useEffect, useState } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformSalesReport, fetchUniformClaims, createUniformClaim, lockUniformClaim, downloadUniformSalesCsv,
  type UniformSalesReport, type UniformClaimRow,
} from "./uniform-admin-api";

interface Props {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
  logistics: boolean;
}

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

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

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 grid gap-3 sm:grid-cols-5">
        <div>
          <SearchableSingleSelect
            label="Sekolah"
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
            value={schoolId}
            onChange={setSchoolId}
            placeholder="Semua"
            disabled={!!lockedSchoolId}
          />
        </div>
        <div><label className={labelCls}>Dari</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Sampai</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></div>
        <div><SearchableSingleSelect
          label="Jenjang"
          options={[
            { value: "", label: "Semua" },
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
        <div><label className={labelCls}>Ukuran</label><input value={size} onChange={(e) => setSize(e.target.value)} placeholder="M / —" className={inputCls} /></div>
        <div><SearchableSingleSelect
          label="Ikhwan/Akhwat"
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
        <div><SearchableSingleSelect
          label="Status bayar"
          options={[
            { value: "", label: "Semua" },
            { value: "unpaid", label: "Belum bayar" },
            { value: "partial", label: "Cicilan" },
            { value: "paid", label: "Lunas" },
            { value: "scholarship_pending", label: "Beasiswa pending" },
          ]}
          value={paymentStatus}
          onChange={setPaymentStatus}
          placeholder="Pilih..."
        />
        </div>
        <div><SearchableSingleSelect
          label="Status bagi"
          options={[
            { value: "", label: "Semua" },
            { value: "belum_dikirim", label: "Belum terbagi" },
            { value: "sudah_dikirim", label: "Sudah terbagi" },
          ]}
          value={shipmentStatus}
          onChange={setShipmentStatus}
          placeholder="Pilih..."
        />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => downloadUniformSalesCsv({ schoolId: schoolId || undefined, from: from || undefined, to: to || undefined, jenjang: jenjang || undefined, size: size.trim() || undefined, gender: gender || undefined, paymentStatus: paymentStatus || undefined, shipmentStatus: shipmentStatus || undefined })}
          className="px-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
        >
          Unduh CSV
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
        >
          Cetak / PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Order", value: String(report?.totals.orderCount ?? 0) },
          { label: "Murid unik", value: String(report?.totals.studentCount ?? 0) },
          { label: "Qty", value: String(report?.totals.quantity ?? 0) },
          { label: "Omzet", value: formatRupiah(report?.totals.revenue ?? 0) },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-[#E4E6EB] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#65676B]">{c.label}</div>
            <div className="text-base font-bold">{loading ? "…" : c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
        <div className="px-4 py-3 text-xs font-bold">Per sekolah × jenjang × ukuran</div>
        {!loading && (report?.rows.length ?? 0) === 0 && (
          <div className="px-4 py-6 text-center text-xs text-[#65676B]">Belum ada penjualan pada filter ini.</div>
        )}
        {(report?.rows ?? []).map((r) => (
          <div key={`${r.schoolId}-${r.jenjang}-${r.size}`} className="px-4 py-3 text-xs flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{r.schoolName} <span className="font-normal text-[#65676B]">· {r.jenjang.toUpperCase()} · {r.size}</span></div>
              <div className="text-[#65676B]">{r.orderCount} order · {r.studentCount} murid · {r.quantity} qty</div>
            </div>
            <div className="font-bold shrink-0">{formatRupiah(r.revenue)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-3">
        <h3 className="text-sm font-bold">Klaim ke Cabang</h3>
        <p className="text-xs text-[#65676B]">Snapshot per periode + sekolah. Setelah dikunci, tukar/refund susulan tidak mengubah angka — selisih diselesaikan periode berikut.</p>
        {logistics && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls}>Periode</label>
              <input type="month" value={claimPeriod} onChange={(e) => setClaimPeriod(e.target.value)} className="rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white" />
            </div>
            <button
              type="button" onClick={handleClaim} disabled={!schoolId}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
            >
              Buat Klaim
            </button>
          </div>
        )}
        <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB]">
          {claims.length === 0 && <div className="px-4 py-4 text-xs text-[#65676B]">Belum ada klaim.</div>}
          {claims.map((c) => (
            <div key={c.id} className="px-4 py-3 text-xs flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{c.claimNumber} <span className="font-normal text-[#65676B]">· {c.period}</span></div>
                <div className="text-[#65676B]">{c.totalQty} qty · {formatRupiah(c.totalAmount)}</div>
                <div className="mt-1">
                  {c.status === "locked" ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Terkunci</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">Draft</span>
                  )}
                </div>
              </div>
              {logistics && c.status === "draft" && (
                <button
                  type="button" onClick={() => handleLock(c.id)}
                  className="shrink-0 px-4 py-2 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
                >
                  Kunci
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
