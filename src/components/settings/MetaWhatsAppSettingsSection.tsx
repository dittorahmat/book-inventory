import { useState, useEffect } from "react";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { apiEnvelope, postJson } from "../../lib/api";

/** Konfigurasi WA Meta Official (Cloud API) untuk kirim invoice satuan. */
export function MetaWhatsAppSettingsSection() {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiEnvelope<{ data: any }>("/api/settings/whatsapp-meta", undefined, "Gagal memuat setting Meta");
        if (cancelled) return;
        setPhoneNumberId(res.data.phoneNumberId || "");
        setAccessToken(res.data.accessToken || "");
        setIsEnabled(res.data.isEnabled ?? false);
      } catch {
        if (!cancelled) setFeedback({ success: false, text: "Gagal memuat pengaturan Meta" });
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
    setFeedback(null);
    try {
      await postJson("/api/settings/whatsapp-meta", { phoneNumberId, accessToken, isEnabled }, "Gagal menyimpan Meta");
      setFeedback({ success: true, text: "Pengaturan WhatsApp Meta berhasil disimpan!" });
    } catch (err: any) {
      setFeedback({ success: false, text: err.message || "Gagal menyimpan" });
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
    setFeedback(null);
    try {
      const res = await postJson<{ success: boolean; message: string }>(
        "/api/settings/whatsapp-meta/test",
        { phone: testPhone, message: "Uji coba invoice WA Meta Official Al Wildan." },
        "Gagal mengirim pesan uji coba"
      );
      setFeedback({ success: true, text: res.message });
    } catch (err: any) {
      setFeedback({ success: false, text: err.message || "Gagal tes kirim pesan" });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-xs text-[#65676B]">Memuat pengaturan Meta...</div>;

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 shadow-xs max-w-3xl mt-4">
      <h3 className="text-sm font-bold text-[#050505] flex items-center gap-2 mb-1">
        <BadgeCheck className="w-4 h-4 text-emerald-600" />
        WhatsApp Meta Official (Invoice Satuan)
      </h3>
      <p className="text-xs text-[#65676B]">Cloud API Meta untuk kirim invoice + link konfirmasi pembayaran ke ortu.</p>
      {feedback && (
        <div className={`mt-4 p-3 rounded-xl border text-xs ${feedback.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          <span>{feedback.text}</span>
        </div>
      )}
      <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="rounded border-[#CED0D4] text-emerald-600" />
          <span className="text-[#050505] font-medium">Aktifkan kirim invoice via Meta</span>
        </label>
        <div>
          <label className="block font-semibold text-[#050505] mb-1">Phone Number ID</label>
          <input type="text" required value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Contoh: 123456789012345" className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs" />
        </div>
        <div>
          <label className="block font-semibold text-[#050505] mb-1">Access Token</label>
          <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Token akses Cloud API" className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isSaving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold active:scale-[0.98] transition-all">
            {isSaving ? "Menyimpan..." : "Simpan Meta"}
          </button>
        </div>
      </form>
      <div className="mt-4 flex gap-2">
        <input type="text" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0812xxxxxxxx" className="flex-1 px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs" />
        <button type="button" disabled={isTesting} onClick={handleTest} className="px-4 py-2 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] rounded-xl font-semibold flex items-center gap-1.5 active:scale-[0.98]">
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isTesting ? "animate-spin" : ""}`} />
          <span>Uji Kirim</span>
        </button>
      </div>
    </div>
  );
}
