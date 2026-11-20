import { useEffect, useState } from "react";
import { apiEnvelope, postJson } from "../../lib/api";

/** Toggle on/off tampilan peringatan persediaan menipis/konveksi di portal seragam publik. */
export function UniformPortalWarningToggle() {
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingWarning, setSavingWarning] = useState(false);
  const [warningFeedback, setWarningFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resWarning = await apiEnvelope<{ data: { showLowStockWarning: boolean } }>(
          "/api/settings/uniform-portal-warning",
          undefined,
          "Gagal memuat setting peringatan portal seragam."
        );
        if (!cancelled) {
          setShowWarning(resWarning.data.showLowStockWarning);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveWarning = async (enabled: boolean) => {
    setSavingWarning(true);
    setWarningFeedback(null);
    try {
      const res = await postJson<{ message?: string }>(
        "/api/settings/uniform-portal-warning",
        { enabled },
        "Gagal menyimpan."
      );
      setShowWarning(enabled);
      setWarningFeedback(res.message ?? "Tersimpan.");
    } catch (err) {
      setWarningFeedback(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSavingWarning(false);
    }
  };

  if (loading) return <div className="text-xs text-[#65676B]">Memuat setting peringatan portal...</div>;
  return (
    <div className="border-t border-[#E4E6EB] pt-4">
      <p className="text-xs font-semibold text-[#050505]">
        Peringatan Persediaan Menipis/Konveksi di Portal — saat ini: {showWarning ? "AKTIF" : "NONAKTIF (Direkomendasikan)"}
      </p>
      <p className="text-[11px] text-[#65676B] mt-0.5">
        Jika nonaktif, portal publik tidak akan menampilkan banner &apos;persediaan sedang diproses konveksi&apos; kepada orang tua siswa.
      </p>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          disabled={savingWarning}
          onClick={() => saveWarning(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border active:scale-[0.98] ${
            showWarning ? "bg-amber-600 text-white border-amber-600" : "bg-white border-[#CED0D4] hover:bg-[#F0F2F5]"
          }`}
        >
          Aktifkan Peringatan
        </button>
        <button
          type="button"
          disabled={savingWarning}
          onClick={() => saveWarning(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border active:scale-[0.98] ${
            !showWarning ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-[#CED0D4] hover:bg-[#F0F2F5]"
          }`}
        >
          Sembunyikan Peringatan (Default)
        </button>
      </div>
      {warningFeedback && <p className="text-xs text-[#65676B] mt-1.5">{warningFeedback}</p>}
    </div>
  );
}
