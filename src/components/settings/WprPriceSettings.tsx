import { useEffect, useState } from "react";
import { apiEnvelope, postJson } from "../../lib/api";
import { formatRupiah } from "../../lib/transfer-pricing";
import { WPR_PRICE } from "../../lib/wpr";

/** Pengaturan nominal WPR (Weekly Progress Report) tahunan buku Al-Wildan. */
export function WprPriceSettings() {
  const [price, setPrice] = useState<number>(WPR_PRICE);
  const [inputVal, setInputVal] = useState<string>(String(WPR_PRICE));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiEnvelope<{ data: { price: number } }>("/api/settings/wpr-price", undefined, "Gagal memuat nominal WPR.");
        if (!cancelled) {
          setPrice(res.data.price);
          setInputVal(String(res.data.price));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputVal.replace(/\D/g, ""), 10);
    if (!Number.isFinite(num) || num <= 0) {
      setFeedback("Nominal WPR harus berupa angka lebih dari 0.");
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await postJson<{ message?: string; data: { price: number } }>(
        "/api/settings/wpr-price",
        { price: num },
        "Gagal menyimpan nominal WPR."
      );
      setPrice(res.data.price);
      setInputVal(String(res.data.price));
      setFeedback(res.message ?? "Nominal WPR berhasil disimpan.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Gagal menyimpan nominal WPR.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-xs text-[#65676B]">Memuat pengaturan WPR...</div>;

  return (
    <div className="border-t border-[#E4E6EB] pt-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-[#050505]">
          Nominal WPR (Weekly Progress Report) Buku
        </p>
        <p className="text-[11px] text-[#65676B]">
          Komponen wajib tahunan untuk buku paket dan order satuan pertama murid. Saat ini:{" "}
          <strong className="text-[#050505]">{formatRupiah(price)}</strong>
        </p>
      </div>
      <form onSubmit={save} className="flex flex-wrap items-center gap-2 mt-2">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#65676B] font-medium">Rp</span>
          <input
            type="text"
            className="w-40 pl-8 pr-3 py-1.5 rounded-lg text-xs border border-[#CED0D4] bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={saving}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan WPR"}
        </button>
      </form>
      {feedback && (
        <p className={`text-[11px] mt-1.5 ${feedback.includes("Gagal") || feedback.includes("harus") ? "text-red-600" : "text-emerald-600"}`}>
          {feedback}
        </p>
      )}
    </div>
  );
}
