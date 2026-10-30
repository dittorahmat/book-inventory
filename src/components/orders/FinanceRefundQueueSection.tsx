import { useEffect, useState } from "react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { getJson, postJson } from "../../lib/api";
import { CheckCircle2, RefreshCw, SendHorizontal, AlertCircle } from "lucide-react";

export interface RefundQueueItem {
  id: string;
  kind: "buku" | "seragam";
  slipNumber: string;
  orderId: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  schoolId: string;
  refundAmount: number;
  approvedAt: string;
  status: "approved" | "refunded";
  courierResi?: string;
}

export function FinanceRefundQueueSection() {
  const [items, setItems] = useState<RefundQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RefundQueueItem | null>(null);
  const [bankName, setBankName] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getJson<RefundQueueItem[]>("/api/payments/refund-queue", "Gagal memuat antrean refund.");
      setItems(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat antrean.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleDisburse = async () => {
    if (!selectedItem) return;
    if (!bankName.trim() || !refNumber.trim()) {
      setError("Nama Bank dan No. Referensi Transfer bukti pencairan wajib diisi.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await postJson<{ success: boolean; message: string }>(
        "/api/payments/disburse-refund",
        {
          kind: selectedItem.kind,
          slipNumber: selectedItem.slipNumber,
          bankName: bankName.trim(),
          referenceNumber: refNumber.trim(),
          notes: notes.trim() || undefined,
        },
        "Gagal mencatat pencairan refund."
      );
      setNotice(res.message);
      setSelectedItem(null);
      setBankName("");
      setRefNumber("");
      setNotes("");
      loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat pencairan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#050505]">Antrean Pencairan Dana Refund (Finance)</h3>
          <p className="text-xs text-[#65676B]">
            Daftar pengembalian buku (`RET-B`) dan seragam (`RET-U`) siswa mengundurkan diri yang telah diverifikasi gudang.
          </p>
        </div>
        <button
          type="button"
          onClick={loadQueue}
          disabled={loading}
          className="p-2 border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] text-[#65676B]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#65676B]">
            Tidak ada slip pengembalian yang menunggu pencairan refund.
          </div>
        ) : (
          items.map((it) => (
            <div key={it.slipNumber} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${it.kind === "buku" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"}`}>
                    {it.kind.toUpperCase()}
                  </span>
                  <span className="font-bold text-[#050505]">{it.slipNumber}</span>
                  <span className="text-[#65676B]">({it.orderNumber})</span>
                </div>
                <div className="text-[#050505] font-medium">{it.studentName} · NIS: {it.nis}</div>
                {it.courierResi && (
                  <div className="text-[11px] text-[#65676B]">Resi Fisik Gudang: {it.courierResi}</div>
                )}
                <div className="text-[11px] text-[#65676B]">Disetujui: {it.approvedAt.slice(0, 10)} {it.approvedAt.slice(11, 16)}</div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                <span className="text-sm font-bold text-emerald-700">{formatRupiah(it.refundAmount)}</span>
                {it.status === "refunded" ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold">
                    Sudah Dicairkan
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedItem(it)}
                    className="px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <SendHorizontal className="w-3.5 h-3.5" />
                    <span>Cairkan Refund</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#E4E6EB]">
            <h4 className="text-sm font-bold text-[#050505]">Konfirmasi Pencairan Dana Refund</h4>
            <div className="p-3 bg-[#F7F8FA] rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#65676B]">Nomor Slip</span>
                <span className="font-semibold text-[#050505]">{selectedItem.slipNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65676B]">Siswa</span>
                <span className="font-semibold text-[#050505]">{selectedItem.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65676B]">Nominal Refund</span>
                <span className="font-bold text-emerald-700">{formatRupiah(selectedItem.refundAmount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Nama Bank Tujuan Transfer <span className="text-red-600">*</span>
                </label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Contoh: BCA / Mandiri / BSI"
                  className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Nomor Referensi Bukti Transfer <span className="text-red-600">*</span>
                </label>
                <input
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Contoh: TRF-202610-88912"
                  className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Catatan Finance</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsional: catatan bank pengirim atau no rekening ortu"
                  className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                disabled={submitting}
                className="px-4 py-2 border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDisburse}
                disabled={submitting}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] disabled:opacity-50"
              >
                {submitting ? "Menyimpan…" : "Simpan Struk Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
