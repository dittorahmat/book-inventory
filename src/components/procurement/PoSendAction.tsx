import { useState } from "react";
import { Send, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";

export interface PoSendTarget {
  id: string;
  poNumber: string;
  status: string;
  sentTo?: string | null;
  sentAt?: string | null;
}

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

  const handleSend = async () => {
    setIsSending(true);
    setOutcome(null);
    try {
      const res = await fetch(`/api/procurement/purchase-orders/${po.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengirim PO ke supplier.");
      }
      if (data.simulated) {
        setOutcome({ kind: "simulated", message: data.message });
      } else {
        setOutcome({ kind: "sent", message: data.message });
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
          disabled={isSending}
          className="px-3 py-1.5 bg-white border border-[#1877F2] text-[#1877F2] hover:bg-[#E7F3FF] active:scale-[0.98] font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {alreadySent ? (
            <RotateCcw className="w-3.5 h-3.5" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isSending ? "Mengirim..." : alreadySent ? "Kirim Ulang" : "Kirim PO"}</span>
        </button>
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
