import { useRef, useState } from "react";
import { Printer, Upload, FileCheck2, AlertCircle, ExternalLink } from "lucide-react";

export interface PoWorkflowTarget {
  id: string;
  poNumber: string;
  status: string;
  printedAt?: string | null;
  signedDocUrl?: string | null;
  signedDocName?: string | null;
  signedDocType?: string | null;
  signedDocUploadedAt?: string | null;
}

interface PoWorkflowActionsProps {
  po: PoWorkflowTarget;
  onChanged: () => void;
  onPrint: () => void;
}

type Feedback = { kind: "ok" | "error"; message: string } | null;

/**
 * Kontrol alur cetak → tanda tangan → upload bukti.
 * Status `sent` dan seterusnya tidak menampilkan upload karena sudah lewat tahap ini.
 */
export function PoWorkflowActions({ po, onChanged, onPrint }: PoWorkflowActionsProps) {
  const [isMarkingPrinted, setIsMarkingPrinted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDraft = po.status === "draft";
  const isPrinted = po.status === "printed";
  const isSignedUploaded = po.status === "signed_uploaded";
  const canUpload = isPrinted;
  const canReupload = isSignedUploaded;
  const isImageEvidence = !!po.signedDocType?.startsWith("image/");

  const handleMarkPrinted = async () => {
    setIsMarkingPrinted(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/procurement/purchase-orders/${po.id}/print`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menandai PO sebagai dicetak.");
      }
      setFeedback({ kind: "ok", message: data.message });
      onChanged();
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal menandai PO sebagai dicetak." });
    } finally {
      setIsMarkingPrinted(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setFeedback(null);
    try {
      const form = new FormData();
      form.append("signedDoc", file);
      const res = await fetch(`/api/procurement/purchase-orders/${po.id}/signed-doc`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengunggah bukti tanda tangan.");
      }
      setFeedback({ kind: "ok", message: data.message });
      onChanged();
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal mengunggah bukti tanda tangan." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      {isDraft && (
        <button
          type="button"
          onClick={handleMarkPrinted}
          disabled={isMarkingPrinted}
          className="px-3 py-1.5 bg-white border border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5] font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
        >
          <Printer className="w-3.5 h-3.5 text-[#65676B]" />
          <span>{isMarkingPrinted ? "Menandai..." : "Tandai Dicetak"}</span>
        </button>
      )}

      {canUpload && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-1.5 bg-[#E7F3FF] text-[#1877F2] hover:bg-[#D8EBFF] font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          title="Upload scan/foto PO bertanda tangan basah dan cap"
        >
          {isUploading ? (
            <Upload className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          <span>{isUploading ? "Mengunggah..." : "Upload Bukti TTD"}</span>
        </button>
      )}

      {po.signedDocUrl && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <a
              href={po.signedDocUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 text-[11px] font-semibold text-[#1877F2] hover:underline inline-flex items-center gap-1"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-40">{po.signedDocName || "Bukti TTD"}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
            {canReupload && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-2 py-0.5 text-[11px] font-semibold text-[#1877F2] hover:bg-[#E7F3FF] rounded-lg transition-all inline-flex items-center gap-1 active:scale-[0.98] disabled:opacity-50"
                title="Ganti atau upload ulang bukti tanda tangan"
              >
                <Upload className={`w-3 h-3 ${isUploading ? "animate-pulse" : ""}`} />
                <span>{isUploading ? "Mengunggah..." : "Ganti"}</span>
              </button>
            )}
          </div>
          {isImageEvidence && (
            <img
              src={po.signedDocUrl}
              alt={`Bukti tanda tangan PO ${po.poNumber}`}
              className="w-28 h-20 object-cover rounded-lg border border-[#E4E6EB]"
            />
          )}
        </div>
      )}

      {(canUpload || canReupload) && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      )}

      <button
        type="button"
        onClick={onPrint}
        className="px-2 py-1 text-[11px] font-semibold text-[#65676B] hover:text-[#050505] hover:underline inline-flex items-center gap-1"
      >
        <Printer className="w-3 h-3" />
        <span>Lihat & Cetak PO</span>
      </button>

      {feedback && (
        <div
          className={`flex items-start gap-1.5 text-[11px] leading-snug max-w-55 ${
            feedback.kind === "ok" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
