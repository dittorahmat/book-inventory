import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { apiEnvelope, postJson } from "../../lib/api";

export function WhatsAppSettingsSection() {
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Halo! Ini adalah pesan uji coba dari sistem Inventaris Buku Al Wildan.");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiEnvelope<{ data: any }>("/api/settings/whatsapp", undefined, "Gagal memuat setting WA");
        if (cancelled) return;
        setGatewayUrl(res.data.gatewayUrl || "");
        setApiKey(res.data.apiKey || "");
        setSenderNumber(res.data.senderNumber || "");
        setIsEnabled(res.data.isEnabled ?? true);
      } catch {
        if (!cancelled) setStatusFeedback({ success: false, text: "Gagal memuat pengaturan WhatsApp" });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusFeedback(null);
    try {
      await postJson(
        "/api/settings/whatsapp",
        { gatewayUrl, apiKey, senderNumber, isEnabled },
        "Gagal menyimpan konfigurasi WhatsApp"
      );
      setStatusFeedback({ success: true, text: "Pengaturan WhatsApp gateway berhasil disimpan!" });
    } catch (err: any) {
      setStatusFeedback({ success: false, text: err.message || "Gagal menyimpan" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone) {
      alert("Masukkan nomor WhatsApp penerima uji coba");
      return;
    }
    setIsTesting(true);
    setStatusFeedback(null);
    try {
      const res = await postJson<{ success: boolean; message: string }>(
        "/api/settings/whatsapp/test",
        { phone: testPhone, message: testMessage },
        "Gagal mengirim pesan uji coba"
      );
      setStatusFeedback({ success: true, text: res.message });
    } catch (err: any) {
      setStatusFeedback({ success: false, text: err.message || "Gagal tes kirim pesan" });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-[#65676B]">Memuat pengaturan WhatsApp...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 shadow-xs">
        <h3 className="text-sm font-bold text-[#050505] flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          Konfigurasi WhatsApp Gateway (Sidecar REST API)
        </h3>
        <p className="text-xs text-[#65676B]">
          Kompatibel penuh dengan Cloudflare Workers. Terhubung ke HTTP REST gateway WhatsApp (nomor sendiri) untuk mengirimkan notifikasi otomatis ke orang tua murid dan konfirmasi pengadaan.
        </p>

        {statusFeedback && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusFeedback.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {statusFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusFeedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#050505] mb-1">Status Notifikasi WhatsApp</label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="rounded border-[#CED0D4] text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[#050505] font-medium">Aktifkan Pengiriman Otomatis Pesan WhatsApp</span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-[#050505] mb-1">Endpoint REST Gateway URL</label>
            <input
              type="url"
              required
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="https://wa-gateway.internal.domain/api/send"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
            />
            <span className="text-[11px] text-[#65676B] mt-0.5 block">
              Alamat endpoint HTTP POST sidecar WhatsApp (Baileys/WPPConnect/Fonnte).
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#050505] mb-1">API Key / Authorization Token</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Bearer token jika ada"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#050505] mb-1">Nomor Pengirim (Sender Device)</label>
              <input
                type="text"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="Contoh: 628123456789 (Opsional)"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold active:scale-[0.98] transition-all"
            >
              {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 shadow-xs">
        <h4 className="text-xs font-bold text-[#050505] flex items-center gap-1.5 mb-2">
          <Send className="w-3.5 h-3.5 text-emerald-600" />
          Uji Coba Pengiriman Pesan WhatsApp
        </h4>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-[#050505] mb-1">Nomor WhatsApp Penerima Uji Coba</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="0812xxxxxxxx / 62812xxxxxxxx"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#050505] mb-1">Isi Pesan Uji Coba</label>
            <textarea
              rows={2}
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
            />
          </div>
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTest}
            className="px-4 py-2 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#050505] rounded-xl font-semibold flex items-center gap-1.5 active:scale-[0.98] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isTesting ? "animate-spin" : ""}`} />
            <span>Kirim Pesan Uji Coba</span>
          </button>
        </div>
      </div>
    </div>
  );
}
