import { useEffect, useState } from "react";
import { apiEnvelope, postJson } from "../../lib/api";

/** Toggle on/off pembelian satuan seragam (cermin cut-off satuan buku). */
export function UniformSatuanToggle() {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiEnvelope<{ data: { open: boolean } }>("/api/settings/uniform-satuan", undefined, "Gagal memuat.");
        if (!cancelled) setOpen(res.data.open);
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

  if (loading) return <div className="text-xs text-[#65676B]">Memuat...</div>;
  return (
    <div className="border-t border-[#E4E6EB] pt-4">
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
  );
}
