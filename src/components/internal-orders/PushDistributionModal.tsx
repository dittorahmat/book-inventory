import { useState, useEffect } from "react";
import { X, Send, AlertCircle, Loader2 } from "lucide-react";
import { api, postJson } from "../../lib/api";
import type { School } from "../../types";

interface PushQuotaData {
  schoolId: string;
  totalActiveStudents: number;
  grades: Array<{
    grade: string;
    studentCount: number;
    packageId: string | null;
    packageName: string | null;
    recommendedQuantity: number;
  }>;
}

interface PushDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  onSuccess: () => void;
}

export function PushDistributionModal({
  isOpen,
  onClose,
  schools,
  onSuccess,
}: PushDistributionModalProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.id || "");
  const [academicYear, setAcademicYear] = useState<string>("2026/2027");
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quotaData, setQuotaData] = useState<PushQuotaData | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedSchoolId) {
      loadQuota(selectedSchoolId, academicYear);
    }
  }, [isOpen, selectedSchoolId, academicYear]);

  const loadQuota = async (schoolId: string, year?: string) => {
    setLoadingQuota(true);
    setError(null);
    try {
      const q = year ? `?academicYear=${encodeURIComponent(year)}` : "";
      const res = await api<{ success: boolean; data: PushQuotaData }>(
        `/api/push-distribution/quota/${schoolId}${q}`
      );
      if (res?.data) {
        setQuotaData(res.data);
        const initialQtys: Record<string, number> = {};
        for (const g of res.data.grades) {
          if (g.packageId) {
            initialQtys[g.packageId] = g.recommendedQuantity;
          }
        }
        setQuantities(initialQtys);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat kuota siswa cabang");
    } finally {
      setLoadingQuota(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) return;

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([pkgId, qty]) => ({
        packageId: pkgId,
        quantity: qty,
      }));

    if (items.length === 0) {
      setError("Pilih minimal 1 paket buku untuk dikirimkan");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await postJson("/api/push-distribution", {
        schoolId: selectedSchoolId,
        notes: notes.trim() || undefined,
        items,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menerbitkan Surat Jalan");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#E4E6EB] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-[#E4E6EB]">
          <div>
            <h2 className="text-base font-bold text-[#050505]">Push Distribution Awal Tahun</h2>
            <p className="text-xs text-[#65676B] mt-0.5">
              Kirim paket buku langsung ke cabang sesuai kuota siswa (Cap Max) tanpa PO.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Pilih Cabang Tujuan
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Tahun Ajaran
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              >
              </input>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Catatan Pengiriman (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Alokasi Awal Tahun Ajaran 2026/2027"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>

          <div className="border border-[#E4E6EB] rounded-xl overflow-hidden">
            <div className="bg-[#F0F2F5] px-4 py-2.5 border-b border-[#E4E6EB] flex justify-between items-center">
              <span className="text-xs font-bold text-[#050505]">Rincian Kuota Kelas & Paket</span>
              {quotaData && (
                <span className="text-xs text-[#65676B]">
                  Total Siswa Aktif: <strong className="text-[#050505]">{quotaData.totalActiveStudents}</strong>
                </span>
              )}
            </div>

            {loadingQuota ? (
              <div className="p-8 text-center text-xs text-[#65676B] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Menghitung kuota siswa cabang…
              </div>
            ) : quotaData?.grades.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#65676B]">
                Tidak ada siswa aktif terdaftar di cabang ini.
              </div>
            ) : (
              <div className="divide-y divide-[#E4E6EB] max-h-60 overflow-y-auto">
                {quotaData?.grades.map((g) => (
                  <div key={g.grade} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[#050505]">
                        Kelas {g.grade} — {g.packageName || "(Belum ada paket terikat)"}
                      </p>
                      <p className="text-[11px] text-[#65676B]">
                        Siswa Aktif: {g.studentCount} anak | Rekomendasi: {g.recommendedQuantity} paket
                      </p>
                    </div>
                    {g.packageId ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={quantities[g.packageId] ?? g.recommendedQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setQuantities((prev) => ({
                              ...prev,
                              [g.packageId!]: isNaN(val) ? 0 : val,
                            }));
                          }}
                          className="w-20 px-2.5 py-1.5 border border-[#CED0D4] rounded-lg text-xs text-right font-medium"
                        />
                        <span className="text-xs text-[#65676B]">paket</span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">Paket tidak tersedia</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || loadingQuota}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim Surat Jalan Langsung
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
