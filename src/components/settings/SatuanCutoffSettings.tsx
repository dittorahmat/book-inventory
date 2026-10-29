import { useCallback, useEffect, useState } from "react";
import { BookOpen, ShieldAlert, Loader2 } from "lucide-react";
import { apiEnvelope, buildQuery, postJson } from "../../lib/api";
import type { SatuanStatus } from "../../lib/portal-types";

interface SatuanCutoffSettingsProps {
  academicYear: string;
}

type Feedback = { kind: "ok" | "error"; message: string } | null;

/**
 * Pengaturan cut-off order satuan buku per tahun ajaran: switch On/Off instan.
 * Hanya peran central admin / admin gudang (dijaga server).
 */
export function SatuanCutoffSettings({ academicYear }: SatuanCutoffSettingsProps) {
  const [status, setStatus] = useState<SatuanStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await apiEnvelope<{ data: SatuanStatus }>(
        buildQuery("/api/settings/satuan-cutoff", { academicYear }),
        undefined,
        "Gagal memuat pengaturan cut-off."
      );
      setStatus(data.data);
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal memuat pengaturan cut-off." });
    } finally {
      setIsLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOverride = async (override: "open" | "closed") => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const data = await postJson<{ message?: string; data: SatuanStatus }>(
        "/api/settings/satuan-cutoff/override",
        { academicYear, override },
        "Gagal menyimpan status cut-off buku satuan."
      );
      setStatus(data.data);
      setFeedback({ kind: "ok", message: data.message ?? "Status cut-off buku satuan tersimpan." });
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal menyimpan status cut-off." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#050505] flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-[#1877F2]" />
          Pembelian Buku Satuan — Tahun Ajaran {academicYear}
        </p>
        <p className="text-[11px] text-[#65676B] mt-0.5">
          Kontrol on/off instan untuk pembelian eceran/satuan buku di portal publik (serupa dengan seragam).
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
              Buku satuan saat ini: {status.open ? "DIBUKA" : "DITUTUP"}
            </p>
            <p className="text-[11px] text-[#65676B] mt-0.5">
              {status.reason}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1.5">Aksi Buka / Tutup Pembelian</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveOverride("open")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-[0.98] ${
                  status.open
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                }`}
              >
                Buka Satuan Buku
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveOverride("closed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-[0.98] ${
                  !status.open
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                }`}
              >
                Tutup Satuan Buku
              </button>
            </div>
            <p className="text-[11px] text-[#65676B] mt-1.5 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Perubahan langsung berdampak pada portal publik siswa secara instan.
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
