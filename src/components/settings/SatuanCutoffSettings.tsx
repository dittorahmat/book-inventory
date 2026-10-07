import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Save, ShieldAlert, Loader2 } from "lucide-react";
import type { SatuanStatus } from "../../lib/portal-types";

interface SatuanCutoffSettingsProps {
  academicYear: string;
}

const inputClass =
  "w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]";

type Feedback = { kind: "ok" | "error"; message: string } | null;

/**
 * Pengaturan cut-off order satuan per tahun ajaran: tanggal efektif WIB +
 * override manual. Hanya peran central admin / admin gudang (dijaga server).
 */
export function SatuanCutoffSettings({ academicYear }: SatuanCutoffSettingsProps) {
  const [status, setStatus] = useState<SatuanStatus | null>(null);
  const [openFrom, setOpenFrom] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/settings/satuan-cutoff?academicYear=${encodeURIComponent(academicYear)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memuat pengaturan cut-off.");
      }
      setStatus(data.data);
      setOpenFrom(data.data.openFrom ?? "");
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal memuat pengaturan cut-off." });
    } finally {
      setIsLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDate = async () => {
    if (!openFrom) {
      setFeedback({ kind: "error", message: "Pilih tanggal efektif pembuka order satuan." });
      return;
    }
    setIsSavingDate(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings/satuan-cutoff/open-from", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear, openFrom }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyimpan tanggal efektif.");
      }
      setStatus(data.data);
      setFeedback({ kind: "ok", message: data.message });
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal menyimpan tanggal efektif." });
    } finally {
      setIsSavingDate(false);
    }
  };

  const saveOverride = async (override: "open" | "closed" | "auto") => {
    setFeedback(null);
    try {
      const res = await fetch("/api/settings/satuan-cutoff/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear, override }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyimpan override.");
      }
      setStatus(data.data);
      setFeedback({ kind: "ok", message: data.message });
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal menyimpan override." });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#050505] flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-[#65676B]" />
          Cut-off Order Satuan — Tahun Ajaran {academicYear}
        </p>
        <p className="text-[11px] text-[#65676B] mt-0.5">
          Tanggal memakai zona WIB. Tanpa pengaturan, order satuan tertutup.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#65676B] py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Memuat pengaturan...</span>
        </div>
      ) : status ? (
        <>
          <div
            className={`rounded-xl border px-3.5 py-2.5 ${
              status.open
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <p className={`text-xs font-bold ${status.open ? "text-emerald-800" : "text-amber-800"}`}>
              Order satuan saat ini: {status.open ? "DIBUKA" : "DITUTUP"}
            </p>
            <p className="text-[11px] text-[#65676B] mt-0.5">
              {status.reason} &bull; Hari ini (WIB): {status.todayWIB}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Tanggal Efektif Buka (WIB)</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                className={inputClass}
                value={openFrom}
                onChange={(e) => setOpenFrom(e.target.value)}
              />
              <button
                type="button"
                onClick={saveDate}
                disabled={isSavingDate}
                className="px-4 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors inline-flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDate ? "Menyimpan..." : "Simpan Tanggal"}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Override Manual (darurat)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveOverride("open")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-[0.98] ${
                  status.override === "open"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                }`}
              >
                Paksa Buka
              </button>
              <button
                type="button"
                onClick={() => saveOverride("closed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-[0.98] ${
                  status.override === "closed"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                }`}
              >
                Paksa Tutup
              </button>
              <button
                type="button"
                onClick={() => saveOverride("auto")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] transition-colors active:scale-[0.98]"
              >
                Kembali ke Aturan Tanggal
              </button>
            </div>
            <p className="text-[11px] text-[#65676B] mt-1.5 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Override mengalahkan tanggal efektif untuk keadaan darurat.
            </p>
          </div>

          {feedback && (
            <p
              className={`text-xs rounded-lg border px-3 py-2 ${
                feedback.kind === "ok"
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-red-600 bg-red-50 border-red-200"
              }`}
            >
              {feedback.message}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-[#65676B]">Pengaturan tidak dapat dimuat.</p>
      )}
    </div>
  );
}
