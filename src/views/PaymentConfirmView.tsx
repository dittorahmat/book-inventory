import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatRupiah } from "../lib/transfer-pricing";
import { getJson, postJson } from "../lib/api";

interface ConfirmData {
  studentName: string | null;
  orderNumber: string;
  totalAmount: number;
  shippingCost: number;
  due: number;
  paidAmount: number;
  paymentStatus: string;
}

interface Props {
  kind: "buku" | "seragam";
  token: string;
}

const base = (kind: string): string => (kind === "seragam" ? "/api/public/uniform-orders" : "/api/public/orders");

/** Link konfirmasi pembayaran dari invoice WA (lunas/bertahap, termin bebas). */
export function PaymentConfirmView({ kind, token }: Props) {
  const [data, setData] = useState<ConfirmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState("");
  const [allocation, setAllocation] = useState("");
  const [bank, setBank] = useState("BCA");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setData(await getJson<ConfirmData>(`${base(kind)}/confirm/${token}`, "Link tidak valid."));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Link tidak valid.");
      }
    })();
  }, [kind, token]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProof(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await postJson(
        `${base(kind)}/confirm/${token}`,
        { transferAmount: parseInt(transfer) || 0, allocationAmount: parseInt(allocation) || 0, bankName: bank, referenceNumber: reference || undefined, paymentProofBase64: proof || undefined },
        "Gagal menyimpan konfirmasi."
      );
      setDone(true);
      setData(await getJson<ConfirmData>(`${base(kind)}/confirm/${token}`, "Link tidak valid."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan konfirmasi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-start justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 w-full max-w-md space-y-4 mt-8">
        <h1 className="text-base font-bold text-[#050505]">Konfirmasi Pembayaran {kind === "seragam" ? "Seragam" : "Buku"}</h1>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>}
        {!data && !error && <div className="text-xs text-[#65676B]">Memuat tagihan...</div>}
        {data && (
          <div className="bg-[#F7F8FA] p-4 rounded-xl text-xs space-y-1.5 border border-[#E4E6EB]">
            <div className="flex justify-between"><span className="text-[#65676B]">Murid:</span><span className="font-semibold">{data.studentName ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#65676B]">Order:</span><span className="font-mono font-bold">{data.orderNumber}</span></div>
            <div className="flex justify-between"><span className="text-[#65676B]">Tagihan:</span><span>{formatRupiah(data.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-[#65676B]">Ongkir:</span><span>{formatRupiah(data.shippingCost)}</span></div>
            <div className="flex justify-between font-bold border-t border-[#E4E6EB] pt-1.5"><span>Total:</span><span>{formatRupiah(data.due)}</span></div>
            <div className="flex justify-between"><span className="text-[#65676B]">Sudah dibayar:</span><span>{formatRupiah(data.paidAmount)} ({data.paymentStatus})</span></div>
            <div className="flex justify-between font-bold"><span>Sisa:</span><span>{formatRupiah(Math.max(0, data.due - data.paidAmount))}</span></div>
          </div>
        )}
        {done && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Konfirmasi tercatat. Status akan diverifikasi admin.</span>
          </div>
        )}
        {data && (
          <form onSubmit={submit} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Nominal Transfer (Rp)</label>
              <input type="number" min={1} required value={transfer} onChange={(e) => setTransfer(e.target.value)} placeholder="Sesuai struk" className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Alokasi untuk Tagihan Ini (Rp)</label>
              <input type="number" min={1} required value={allocation} onChange={(e) => setAllocation(e.target.value)} placeholder="Bisa bertahap/cicilan" className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl" />
              <span className="text-[10px] text-[#65676B]">Boleh kurang dari total (bertahap) atau lunas sekaligus.</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Bank</label>
                <input type="text" value={bank} onChange={(e) => setBank(e.target.value)} className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold mb-1">No. Referensi</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Opsional" className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl" />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Bukti Transfer (opsional)</label>
              <input type="file" accept="image/*" onChange={onFile} className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white" />
            </div>
            <button type="submit" disabled={submitting} className="w-full px-4 py-2.5 bg-[#1877F2] text-white rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98]">
              {submitting ? "Mengirim..." : "Kirim Konfirmasi"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
