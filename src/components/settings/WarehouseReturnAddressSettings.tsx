import { useState, useEffect } from "react";
import { MapPin, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";

interface ReturnAddressData {
  recipientName: string;
  phone: string;
  addressLine: string;
  district: string;
  city: string;
  postalCode: string;
  notes?: string;
}

export function WarehouseReturnAddressSettings() {
  const [data, setData] = useState<ReturnAddressData>({
    recipientName: "",
    phone: "",
    addressLine: "",
    district: "",
    city: "",
    postalCode: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    api<ReturnAddressData>("/api/settings/return-address")
      .then((res) => {
        if (active && res) {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (active) setFeedback({ type: "error", text: err instanceof Error ? err.message : "Gagal memuat alamat retur" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api<ReturnAddressData>("/api/settings/return-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res) setData(res);
      setFeedback({ type: "success", text: "Alamat retur Gudang Pusat berhasil disimpan." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan alamat retur";
      setFeedback({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-[#65676B]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Memuat alamat retur gudang...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] p-5 shadow-xs max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-5 h-5 text-[#1877F2]" />
        <h3 className="text-sm font-bold text-[#050505]">Alamat Retur Gudang Pusat</h3>
      </div>
      <p className="text-xs text-[#65676B] mb-5">
        Alamat ini disajikan secara publik kepada orang tua di portal saat mengajukan retur fisik seragam atau pembatalan pesanan.
      </p>

      {feedback && (
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-4 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Nama Penerima / PIC Gudang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.recipientName}
              onChange={(e) => setData({ ...data, recipientName: e.target.value })}
              placeholder="Gudang Retur Al Wildan"
              className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Nomor Telepon / WA Gudang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
              placeholder="081234567890"
              className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Alamat Jalan / Patokan <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={data.addressLine}
            onChange={(e) => setData({ ...data, addressLine: e.target.value })}
            placeholder="Jl. Boulevard Al Wildan No. 1, Gudang Sentral Logistik"
            className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Kecamatan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.district}
              onChange={(e) => setData({ ...data, district: e.target.value })}
              placeholder="Kelapa Dua"
              className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Kota / Kabupaten <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value })}
              placeholder="Kabupaten Tangerang"
              className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Kode Pos <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.postalCode}
              onChange={(e) => setData({ ...data, postalCode: e.target.value })}
              placeholder="15810"
              className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Catatan Tambahan untuk Pengirim
          </label>
          <input
            type="text"
            value={data.notes || ""}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Contoh: Wajib cantumkan No. Tiket di bungkus paket"
            className="w-full text-xs px-3 py-2 border border-[#CCD0D5] rounded-lg focus:outline-none focus:border-[#1877F2]"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Menyimpan..." : "Simpan Alamat Retur"}
        </button>
      </form>
    </div>
  );
}
