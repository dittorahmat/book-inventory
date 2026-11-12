import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { apiEnvelope, getJson } from "../../lib/api";

export function DemoModeSettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<{ enabled: boolean }>("/api/settings/demo-mode");
      if (data) {
        setEnabled(data.enabled);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat status mode demo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async () => {
    const nextState = !enabled;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await apiEnvelope<{ success: boolean; message?: string; data: { enabled: boolean } }>(
        "/api/settings/demo-mode",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextState }),
        }
      );
      if (res.success && res.data) {
        setEnabled(res.data.enabled);
        setMessage(res.message || (nextState ? "Mode demo aktif" : "Mode demo dinonaktifkan"));
      } else {
        setError(res.message || "Gagal mengubah status mode demo");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan mode demo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs p-5 max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#050505] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#FA383E]" />
            Override Stok Langsung (Mode Demo / Inisialisasi)
          </h2>
          <p className="text-xs text-[#65676B] mt-1">
            Mengizinkan pengaturan saldo stok fisik (Buku dan Seragam, baik satuan maupun paket) secara instan tanpa melalui siklus Purchase Order (PO) atau perakitan fisik.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-[#65676B]">Memuat...</span>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                enabled ? "bg-[#1877F2]" : "bg-[#CED0D4]"
              } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>
      </div>

      <div
        className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
          enabled
            ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
            : "bg-[#F0F2F5] border-[#E4E6EB] text-[#65676B]"
        }`}
      >
        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${enabled ? "text-[#DC2626]" : "text-[#65676B]"}`} />
        <div>
          <span className="font-bold block mb-0.5">
            {enabled ? "PERINGATAN: Mode Override Sedang AKTIF" : "Mode Override Aman (NONAKTIF)"}
          </span>
          {enabled ? (
            <p>
              Staf gudang/logistik dapat langsung mengubah angka stok di layar inventori. Harap matikan kembali setelah demo atau proses inisialisasi data selesai untuk mencegah selisih stok tidak wajar di operasional harian.
            </p>
          ) : (
            <p>
              Seluruh mutasi stok wajib melalui alur penerimaan PO, serah terima, retur, atau perakitan paket resmi.
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#065F46] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
