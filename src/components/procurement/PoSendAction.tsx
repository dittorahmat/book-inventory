import { useState } from "react";
import { Send, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { apiEnvelope } from "../../lib/api";

export interface PoSendTarget {
  id: string;
  poNumber: string;
  status: string;
  signedDocUrl?: string | null;
  sentTo?: string | null;
  sentAt?: string | null;
  /** Gerbang kirim dari server — bila ada, dipakai; cerminan lokal hanya fallback. */
  canSend?: boolean;
  sendBlockedReason?: string | null;
}

/**
 * Status PO lama (sebelum alur cetak-TTD-upload): tetap boleh dikirim
 * tanpa bukti. Cerminan server `evaluateSendGate` — jangan tambah
 * status baru di sini tanpa mengubah server juga.
 */
const LEGACY_SEND_STATUSES: ReadonlySet<string> = new Set([
  "ordered",
  "sent",
  "partially_received",
  "received",
  "cancelled",
]);

interface PoSendActionProps {
  po: PoSendTarget;
  onSent: () => void;
}

type Outcome =
  | { kind: "sent"; message: string }
  | { kind: "simulated"; message: string }
  | { kind: "failed"; message: string };

/** Tombol Kirim/Kirim Ulang PO + badge status pengiriman yang jujur. */
export function PoSendAction({ po, onSent }: PoSendActionProps) {
  const [isSending, setIsSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const alreadySent = po.status === "sent";
  // Gerbang kirim: server adalah pemilik (canSend); cerminan lokal hanya fallback
  // selama respons API belum menyertakan gate.
  const needsTtd = po.canSend === undefined
    ? !LEGACY_SEND_STATUSES.has(po.status) && !po.signedDocUrl
    : !po.canSend;
  const blockedReason = po.sendBlockedReason ?? "Upload bukti TTD dan cap terlebih dahulu sebelum mengirim PO";

  const handleSend = async () => {
    setIsSending(true);
    setOutcome(null);
    try {
      const data = await apiEnvelope<{ success: boolean; simulated?: boolean; message?: string }>(
        `/api/procurement/purchase-orders/${po.id}/send`,
        { method: "POST" },
        "Gagal mengirim PO ke supplier."
      );
      if (data.simulated) {
        setOutcome({ kind: "simulated", message: data.message ?? "PO disimulasikan." });
      } else {
        setOutcome({ kind: "sent", message: data.message ?? "PO terkirim." });
      }
      onSent();
    } catch (err: any) {
      setOutcome({ kind: "failed", message: err.message || "Gagal mengirim PO." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {alreadySent && (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
          TERKIRIM{po.sentTo ? ` KE ${po.sentTo}` : ""}
        </span>
      )}
      <div>
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || needsTtd}
          title={needsTtd ? blockedReason : undefined}
          className="px-3 py-1.5 bg-white border border-[#1877F2] text-[#1877F2] hover:bg-[#E7F3FF] active:scale-[0.98] font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {alreadySent ? (
            <RotateCcw className="w-3.5 h-3.5" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isSending ? "Mengirim..." : alreadySent ? "Kirim Ulang" : "Kirim PO"}</span>
        </button>
        {needsTtd && (
          <p className="mt-1 text-[11px] text-amber-700 leading-snug max-w-55">
            Upload bukti TTD &amp; cap dulu sebelum kirim ke supplier.
          </p>
        )}
      </div>
      {outcome && (
        <div
          className={`flex items-start gap-1.5 text-[11px] leading-snug max-w-55 ${
            outcome.kind === "sent"
              ? "text-emerald-700"
              : outcome.kind === "simulated"
                ? "text-amber-700"
                : "text-red-600"
          }`}
        >
          {outcome.kind === "failed" ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
          )}
          <span>{outcome.message}</span>
        </div>
      )}
    </div>
  );
}
