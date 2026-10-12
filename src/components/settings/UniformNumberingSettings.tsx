import { useEffect, useState } from "react";
import { getJson, postJson } from "../../lib/api";

export function UniformNumberingSettings() {
  const [orderPrefix, setOrderPrefix] = useState("USO");
  const [claimPrefix, setClaimPrefix] = useState("CLM");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJson<{ orderPrefix: string; claimPrefix: string }>("/api/settings/uniform-numbering", "Gagal memuat penomoran seragam.")
      .then((d) => {
        setOrderPrefix(d.orderPrefix);
        setClaimPrefix(d.claimPrefix);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat penomoran seragam."));
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await postJson("/api/settings/uniform-numbering", { orderPrefix: orderPrefix.trim(), claimPrefix: claimPrefix.trim() }, "Gagal menyimpan penomoran.");
      setNotice("Prefix tersimpan — order/klaim baru memakai format ini.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan penomoran.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 space-y-4">
        <p className="text-xs text-[#65676B]">Prefix nomor order (USO-…) dan klaim (CLM-…). 1–10 karakter A–Z/0–9/-.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Prefix order</label>
            <input value={orderPrefix} onChange={(e) => setOrderPrefix(e.target.value.toUpperCase())} className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Prefix klaim</label>
            <input value={claimPrefix} onChange={(e) => setClaimPrefix(e.target.value.toUpperCase())} className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm" />
          </div>
        </div>
        <button
          type="button" onClick={save} disabled={busy}
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
