import { useEffect, useState } from "react";
import { apiEnvelope, postJson } from "../../lib/api";

/** Toggle on/off pembelian satuan seragam (cermin cut-off satuan buku) & peringatan persediaan konveksi portal. */
export function UniformSatuanToggle() {
  const [open, setOpen] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWarning, setSavingWarning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [warningFeedback, setWarningFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [resSatuan, resWarning] = await Promise.all([
          apiEnvelope<{ data: { open: boolean } }>("/api/settings/uniform-satuan", undefined, "Gagal memuat."),
          apiEnvelope<{ data: { showLowStockWarning: boolean } }>("/api/settings/uniform-portal-warning", undefined, "Gagal memuat."),
        ]);
        if (!cancelled) {
          setOpen(resSatuan.data.open);
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

  const save = async (enabled: boolean) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await postJson<{ message?: string }>("/api/settings/uniform-satuan", { enabled }, "Gagal menyimpan.");
      setOpen(enabled);
      setFeedback(res.message ?? "Tersimpan.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const saveWarning = async (enabled: boolean) => {
    setSavingWarning(true);
    setWarningFeedback(null);
    try {
      const res = await postJson<{ message?: string }>("/api/settings/uniform-portal-warning", { enabled }, "Gagal menyimpan.");
      setShowWarning(enabled);
      setWarningFeedback(res.message ?? "Tersimpan.");
    } catch (err) {
      setWarningFeedback(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSavingWarning(false);
    }
  };

  if (loading) return <div className="text-xs text-[#65676B]">Memuat...</div>;
  return (
    <div className="border-t border-[#E4E6EB] pt-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#050505]">Satuan Seragam — saat ini: {open ? "DIBUKA" : "DITUTUP"}</p>
        <div className="flex gap-2 mt-2">
          <button type="button" disabled={saving} onClick={() => save(true)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border active:scale-[0.98] ${open ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-[#CED0D4] hover:bg-[#F0F2F5]"}`}>
            Buka Satuan
          </button>
          <button type="button" disabled={saving} onClick={() => save(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border active:scale-[0.98] ${!open ? "bg-red-600 text-white border-red-600" : "bg-white border-[#CED0D4] hover:bg-[#F0F2F5]"}`}>
            Tutup Satuan
          </button>
        </div>
        {feedback && <p className="text-xs text-[#65676B] mt-1.5">{feedback}</p>}
      </div>

      <div className="border-t border-[#F0F2F5] pt-3">
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
    </div>
  );
}
