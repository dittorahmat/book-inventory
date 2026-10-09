import { useState } from "react";
import { X, Award } from "lucide-react";
import { postJson } from "../../lib/api";
import type { StudentOrder } from "./order-types";

interface ScholarshipApprovalModalProps {
  order: StudentOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export function ScholarshipApprovalModal({ order, onClose, onSuccess }: ScholarshipApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await postJson(
        `/api/payments/orders/${order.id}/scholarship`,
        { action },
        "Gagal memproses approval"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses approval");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#050505] flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            Verifikasi Bukti Beasiswa
          </h3>
          <button onClick={onClose} className="text-[#65676B] hover:text-[#050505]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-xs">
          {errorMsg && <div className="text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</div>}
          <div>
            <span className="text-[#65676B]">Murid:</span>{" "}
            <span className="font-bold text-[#050505]">{order.studentName}</span>
          </div>
          <div>
            <span className="text-[#65676B]">Paket Buku:</span>{" "}
            <span className="font-semibold text-[#050505]">{order.packageName}</span>
          </div>
          <div>
            <label className="block font-semibold mb-2">Lampiran Dokumen:</label>
            {order.scholarshipProofUrl ? (
              <img
                src={order.scholarshipProofUrl}
                alt="Bukti Beasiswa"
                className="max-h-64 rounded-xl border border-[#CED0D4] object-contain w-full bg-[#F0F2F5]"
              />
            ) : (
              <div className="p-4 bg-[#F0F2F5] text-center text-[#65676B] rounded-xl">
                Tidak ada dokumen bukti yang dilampirkan.
              </div>
            )}
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction("reject")}
              className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl font-semibold"
            >
              Tolak Beasiswa
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction("approve")}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
            >
              Setujui (Diskon 100%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
