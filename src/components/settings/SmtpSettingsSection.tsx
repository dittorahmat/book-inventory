import { useState, useEffect } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { apiEnvelope, postJson } from "../../lib/api";

export function SmtpSettingsSection() {
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("Al Wildan School Logistics");
  const [fromEmail, setFromEmail] = useState("logistics@alwildan.sch.id");
  const [emailProvider, setEmailProvider] = useState<"auto" | "brevo" | "smtp">("auto");
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [transportBadge, setTransportBadge] = useState<{
    provider: string;
    smtpConfigured: boolean;
    brevoConfigured: boolean;
  } | null>(null);
  const [lastTest, setLastTest] = useState<{ provider: string; simulated: boolean } | null>(null);
  const [testRecipient, setTestRecipient] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await apiEnvelope<{ data: Record<string, unknown> }>(
          "/api/settings/smtp",
          undefined,
          "Gagal memuat konfigurasi email."
        );
        if (cancelled) return;
        const data = loaded.data;
        setHost((data.host as string) || "smtp.gmail.com");
        setPort((data.port as number) || 587);
        setSecure(Boolean(data.secure));
        setUsername((data.username as string) || "");
        setFromName((data.fromName as string) || "Al Wildan School Logistics");
        setFromEmail((data.fromEmail as string) || "logistics@alwildan.sch.id");
        if (data.provider === "brevo" || data.provider === "smtp" || data.provider === "auto") {
          setEmailProvider(data.provider);
        }
        setTransportBadge({
          provider: (data.provider as string) || "auto",
          smtpConfigured: Boolean(data.smtpConfigured),
          brevoConfigured: Boolean(data.brevoConfigured),
        });
      } catch {
        if (!cancelled) setMessage("Gagal memuat konfigurasi email. Periksa koneksi Anda.");
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
    setMessage(null);
    try {
      await postJson<{ message?: string }>(
        "/api/settings/smtp",
        {
          host,
          port,
          secure,
          username,
          password: password || undefined,
          fromName,
          fromEmail,
          emailProvider,
          brevoApiKey: brevoApiKey || undefined,
        },
        "Gagal menyimpan"
      );
      setBrevoApiKey("");
      setMessage("Konfigurasi server email berhasil disimpan.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testRecipient) {
      setMessage("Masukkan alamat email tujuan uji coba.");
      return;
    }
    setIsTesting(true);
    setMessage(null);
    setLastTest(null);
    try {
      const data = await postJson<{ message?: string; data?: { provider?: string; simulated?: boolean } }>(
        "/api/settings/smtp/test",
        { recipientEmail: testRecipient },
        "Uji email gagal"
      );
      setLastTest({
        provider: data.data?.provider || "?",
        simulated: Boolean(data.data?.simulated),
      });
      setMessage(data.message ?? "Uji email selesai.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E4E6EB] text-xs text-[#65676B]">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#1877F2]" />
        Memuat konfigurasi SMTP...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-base font-bold text-[#050505]">Pengaturan Server Email SMTP</h3>
        <p className="text-xs text-[#65676B] mt-0.5">
          Digunakan untuk pengiriman otomatis notifikasi pesanan, konfirmasi pembayaran, dan serah terima buku ke orang tua murid.
        </p>
        {transportBadge && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className="text-[10px] font-bold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-full uppercase tracking-wider">
              {transportBadge.provider === "brevo"
                ? "API HTTP (Brevo)"
                : transportBadge.provider === "smtp"
                  ? "SMTP"
                  : "Otomatis"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${transportBadge.smtpConfigured ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-[#65676B] bg-[#F0F2F5]"}`}>
              SMTP {transportBadge.smtpConfigured ? "Terisi" : "Kosong"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${transportBadge.brevoConfigured ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-[#65676B] bg-[#F0F2F5]"}`}>
              Brevo {transportBadge.brevoConfigured ? "Terisi" : "Kosong"}
            </span>
          </div>
        )}
      </div>

      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1877F2]" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-semibold mb-1">Host Server SMTP</label>
          <input
            type="text"
            required
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="smtp.gmail.com"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Port SMTP</label>
          <input
            type="number"
            required
            placeholder="587"
            value={port === 0 ? "" : port}
            onChange={(e) => setPort(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Username / Email Akun</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="admin@alwildan.sch.id"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Password SMTP / App Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="Kosongkan jika tidak ingin mengubah"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Nama Pengirim (From Name)</label>
          <input
            type="text"
            required
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Email Pengirim (From Email)</label>
          <input
            type="email"
            required
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Provider Pengiriman</label>
          <select
            value={emailProvider}
            onChange={(e) => setEmailProvider(e.target.value as "auto" | "brevo" | "smtp")}
            className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl"
          >
            <option value="auto">Otomatis (SMTP di lokal, API di Workers)</option>
            <option value="brevo">API HTTP (Brevo)</option>
            <option value="smtp">SMTP</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Brevo API Key</label>
          <input
            type="password"
            value={brevoApiKey}
            onChange={(e) => setBrevoApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="xkeysib-... (kosongkan bila tidak diubah)"
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="secure"
            checked={secure}
            onChange={(e) => setSecure(e.target.checked)}
            className="w-4 h-4 rounded text-[#1877F2]"
          />
          <label htmlFor="secure" className="font-semibold text-[#050505] cursor-pointer">
            Gunakan Enkripsi TLS/SSL Aman (Biasanya untuk port 465)
          </label>
        </div>

        <div className="sm:col-span-2 pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl font-semibold shadow-xs hover:bg-[#166FE5] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>
        </div>
      </form>

      {/* Test Email Section */}
      <div className="border-t border-[#E4E6EB] pt-5">
        <h4 className="text-xs font-bold text-[#050505] uppercase tracking-wider mb-2">
          Uji Coba Pengiriman Email
        </h4>
        {lastTest && (
          <div className="mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${lastTest.simulated ? "text-amber-700 bg-amber-50 border border-amber-200" : "text-emerald-700 bg-emerald-50 border border-emerald-200"}`}>
              Uji via {lastTest.provider} — {lastTest.simulated ? "Simulasi" : "Terkirim"}
            </span>
          </div>
        )}
        <div className="flex gap-2 max-w-md">
          <input
            type="email"
            placeholder="Masukkan email penerima tes..."
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            className="flex-1 px-3 py-2 border border-[#CED0D4] rounded-xl text-xs"
          />
          <button
            type="button"
            disabled={isTesting}
            onClick={handleSendTest}
            className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] active:scale-[0.98] transition-all font-semibold text-xs text-[#050505] rounded-xl disabled:opacity-50"
          >
            {isTesting ? "Mengirim..." : "Kirim Tes"}
          </button>
        </div>
      </div>
    </div>
  );
}
