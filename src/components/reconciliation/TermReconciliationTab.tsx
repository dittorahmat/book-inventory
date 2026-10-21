import { useState, useEffect } from "react";
import { FileText, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { api, postJson } from "../../lib/api";
import { formatRupiah } from "../../lib/transfer-pricing";
import { TermReconciliationPrintModal, type StudentRecapItem } from "./TermReconciliationPrintModal";
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

interface TermReconciliationTabProps {
  schools: School[];
  activeSchoolId: string | null;
  isCentralAdmin: boolean;
}

export function TermReconciliationTab({
  schools,
  activeSchoolId,
  isCentralAdmin,
}: TermReconciliationTabProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    activeSchoolId || schools[0]?.id || ""
  );
  const [academicYear, setAcademicYear] = useState("2026/2027");
  const [term, setTerm] = useState("Ganjil");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<AuditPackageRow[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [savedRecon, setSavedRecon] = useState<{ id: string; reconciliationNumber: string } | null>(null);
  const [recapData, setRecapData] = useState<StudentRecapItem[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [returnSuccessNotice, setReturnSuccessNotice] = useState<string | null>(null);
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSchoolId) {
      loadAuditData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId, academicYear, term]);

  const loadAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: { packages: AuditPackageRow[] } }>(
        `/api/term-reconciliation/compile?schoolId=${selectedSchoolId}&academicYear=${encodeURIComponent(
          academicYear
        )}&term=${encodeURIComponent(term)}`
      );
      if (res?.data?.packages) {
        setPackages(res.data.packages);
        const initialPhys: Record<string, number> = {};
        for (const p of res.data.packages) {
          initialPhys[p.packageId] = p.systemRemaining;
        }
        setPhysicalCounts(initialPhys);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data audit rekonsiliasi");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = packages.map((p) => ({
        itemType: "package" as const,
        packageId: p.packageId,
        totalInbound: p.totalInbound,
        totalDistributed: p.totalDistributed,
        physicalRemaining: physicalCounts[p.packageId] ?? p.systemRemaining,
        unitPrice: p.unitPrice,
      }));

      const res = await postJson<{ success: boolean; data: { id: string; reconciliationNumber: string } }>(
        "/api/term-reconciliation",
        {
          schoolId: selectedSchoolId,
          academicYear,
          term,
          items,
        }
      );
      if (res?.data) {
        setSavedRecon(res.data);
        const recapRes = await api<{ success: boolean; data: StudentRecapItem[] }>(
          `/api/term-reconciliation/recap/${selectedSchoolId}`
        );
        if (recapRes?.data) {
          setRecapData(recapRes.data);
        }
        setShowPrintModal(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan berita acara");
    } finally {
      setSaving(false);
    }
  };

  const handleReturnPhysicalRemaining = async () => {
    const returnItems = packages
      .map((p) => ({
        packageId: p.packageId,
        quantity: physicalCounts[p.packageId] ?? p.systemRemaining,
      }))
      .filter((it) => it.quantity > 0);

    if (returnItems.length === 0) {
      setError("Tidak ada sisa fisik paket untuk ditarik.");
      return;
    }

    setCreatingReturn(true);
    setError(null);
    setReturnSuccessNotice(null);

    try {
      const warehouse = schools.find((s) => s.type === "warehouse" || s.type === "main") || schools[0];
      const res = await postJson<{ success: boolean; message: string; data?: { shipmentId?: string } }>(
        "/api/internal-orders/shipments/manual",
        {
          destinationSchoolId: warehouse.id,
          deliveryNoteNumber: `SJ-RETUR-${Date.now().toString().slice(-6)}`,
          notes: `[Retur Sisa Akhir Periode] Penarikan sisa fisik dari ${selectedSchool?.name || "cabang"}`,
          items: returnItems,
        }
      );
      if (res?.success) {
        setReturnSuccessNotice(
          `Surat Jalan penarikan ${totalPhysicalRemaining} paket ke Gudang Pusat berhasil diterbitkan.`
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menerbitkan Surat Jalan penarikan sisa");
    } finally {
      setCreatingReturn(false);
    }
  };

  // Kalkulasi agregat
  let totalInbound = 0;
  let totalDistributed = 0;
  let totalSystemRemaining = 0;
  let totalPhysicalRemaining = 0;
  let totalDiscrepancy = 0;
  let totalLossAmount = 0;

  for (const p of packages) {
    const phys = physicalCounts[p.packageId] ?? p.systemRemaining;
    const diff = Math.max(0, p.systemRemaining - phys);
    totalInbound += p.totalInbound;
    totalDistributed += p.totalDistributed;
    totalSystemRemaining += p.systemRemaining;
    totalPhysicalRemaining += phys;
    totalDiscrepancy += diff;
    totalLossAmount += diff * p.unitPrice;
  }

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {isCentralAdmin && (
            <div>
              <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Pilih Cabang</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Tahun Ajaran</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-28 px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Semester / Term</label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalPhysicalRemaining > 0 && isCentralAdmin && (
            <button
              type="button"
              onClick={handleReturnPhysicalRemaining}
              disabled={creatingReturn || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
            >
              {creatingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Tarik Sisa ({totalPhysicalRemaining} Paket) ke Gudang
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || loading || packages.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Finalisasi & Cetak Berita Acara
          </button>
        </div>
      </div>

      {returnSuccessNotice && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
          {returnSuccessNotice}
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Total Buku Terkirim</p>
          <p className="text-lg font-bold text-[#050505] mt-0.5">{totalInbound} paket</p>
          <p className="text-[11px] text-[#65676B] mt-0.5">Diserahkan: {totalDistributed} paket</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Target Sisa di Rak</p>
          <p className="text-lg font-bold text-blue-600 mt-0.5">{totalSystemRemaining} paket</p>
          <p className="text-[11px] text-[#65676B] mt-0.5">Sisa sistem seharusnya</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Sisa Fisik Nyata (Ditarik)</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">{totalPhysicalRemaining} paket</p>
          <p className="text-[11px] text-[#65676B] mt-0.5">Masuk kembali ke Gudang</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E4E6EB]">
          <p className="text-[11px] font-medium text-[#65676B]">Selisih Hilang (Ditagihkan)</p>
          <p className={`text-lg font-bold mt-0.5 ${totalDiscrepancy > 0 ? "text-red-600" : "text-[#050505]"}`}>
            {totalDiscrepancy} paket
          </p>
          <p className="text-[11px] text-red-600 font-semibold mt-0.5">
            {formatRupiah(totalLossAmount)}
          </p>
        </div>
      </div>

      {/* Table Audit Fisik */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
        <div className="p-3 bg-[#F0F2F5] border-b border-[#E4E6EB] flex justify-between items-center">
          <span className="text-xs font-bold text-[#050505]">Rincian Audit Stok Fisik per Paket</span>
          <span className="text-xs text-[#65676B]">
            {selectedSchool?.name} ({academicYear} - {term})
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-[#65676B] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Mengompilasi data inbound & serah terima…
          </div>
        ) : packages.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#65676B]">
            Tidak ada data paket atau pengiriman pada cabang dan periode ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F0F2F5] text-[#65676B] font-semibold border-b border-[#E4E6EB]">
                <tr>
                  <th className="px-4 py-2.5">Paket Buku</th>
                  <th className="px-3 py-2.5 text-center">Harga Satuan</th>
                  <th className="px-3 py-2.5 text-center">Terkirim (In)</th>
                  <th className="px-3 py-2.5 text-center">Serah Siswa (Out)</th>
                  <th className="px-3 py-2.5 text-center">Sisa Sistem</th>
                  <th className="px-4 py-2.5 text-center w-36">Fisik Aktual (Audit)</th>
                  <th className="px-3 py-2.5 text-center">Selisih</th>
                  <th className="px-4 py-2.5 text-right">Nilai Tagihan Hilang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6EB]">
                {packages.map((p) => {
                  const phys = physicalCounts[p.packageId] ?? p.systemRemaining;
                  const diff = Math.max(0, p.systemRemaining - phys);
                  const loss = diff * p.unitPrice;

                  return (
                    <tr key={p.packageId} className="hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#050505]">{p.packageName}</p>
                        <p className="text-[11px] text-[#65676B]">Kelas {p.targetGrade || "—"}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-[#65676B]">{formatRupiah(p.unitPrice)}</td>
                      <td className="px-3 py-3 text-center font-medium">{p.totalInbound}</td>
                      <td className="px-3 py-3 text-center font-medium text-emerald-600">{p.totalDistributed}</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-600">{p.systemRemaining}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={p.systemRemaining}
                          value={phys}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setPhysicalCounts((prev) => ({
                              ...prev,
                              [p.packageId]: isNaN(val) ? 0 : val,
                            }));
                          }}
                          className={`w-20 px-2.5 py-1.5 border rounded-lg text-xs text-right font-bold ${
                            diff > 0 ? "border-red-400 bg-red-50 text-red-700" : "border-[#CED0D4]"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {diff > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> -{diff}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium inline-flex items-center gap-0.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Pas
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {loss > 0 ? formatRupiah(loss) : "Rp 0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TermReconciliationPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        reconciliationNumber={savedRecon?.reconciliationNumber}
        school={selectedSchool}
        academicYear={academicYear}
        term={term}
        packages={packages}
        physicalCounts={physicalCounts}
        totalInbound={totalInbound}
        totalDistributed={totalDistributed}
        totalSystemRemaining={totalSystemRemaining}
        totalPhysicalRemaining={totalPhysicalRemaining}
        totalDiscrepancy={totalDiscrepancy}
        totalLossAmount={totalLossAmount}
        recapData={recapData}
      />
    </div>
  );
}
