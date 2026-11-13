import { useState, useRef } from "react";
import { X, Upload, CheckCircle2, AlertCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { parseBulkResiText, type BulkResiRowInput } from "../../lib/bulk-resi";
import {
  previewBulkUniformResi,
  commitBulkUniformResi,
  type BulkResiPreviewItem,
} from "./uniform-admin-api";

interface BulkResiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedSchoolId?: string;
  schoolName?: string;
}

export function BulkResiModal({
  isOpen,
  onClose,
  onSuccess,
  selectedSchoolId,
  schoolName,
}: BulkResiModalProps) {
  const [inputText, setInputText] = useState("");
  const [parsedRows, setParsedRows] = useState<BulkResiRowInput[]>([]);
  const [previewItems, setPreviewItems] = useState<BulkResiPreviewItem[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [step, setStep] = useState<"input" | "preview">("input");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setInputText("");
    setParsedRows([]);
    setPreviewItems([]);
    setValidCount(0);
    setErrorCount(0);
    setValidationError(null);
    setStatusMessage(null);
    setStep("input");
  };

  const handleParseAndPreview = async () => {
    setValidationError(null);
    setStatusMessage(null);

    const parsed = parseBulkResiText(inputText);
    if (parsed.length === 0) {
      setValidationError("Format teks tidak valid atau kosong. Harap gunakan format: NIS | NAMA | Resi");
      textareaRef.current?.focus();
      return;
    }

    setParsedRows(parsed);
    setBusy(true);

    try {
      const res = await previewBulkUniformResi({
        schoolId: selectedSchoolId || undefined,
        rows: parsed,
      });

      setPreviewItems(res.items);
      setValidCount(res.validCount);
      setErrorCount(res.errorCount);
      setStep("preview");
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Gagal memverifikasi data resi.");
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (validCount === 0) {
      setValidationError("Tidak ada baris data valid yang dapat disimpan.");
      return;
    }

    setBusy(true);
    setValidationError(null);

    try {
      const result = await commitBulkUniformResi({
        schoolId: selectedSchoolId || undefined,
        rows: parsedRows,
      });

      setStatusMessage(`Berhasil memperbarui ${result.updatedCount} resi pengiriman.`);
      setTimeout(() => {
        onSuccess();
        onClose();
        handleReset();
      }, 1200);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Gagal menyimpan resi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Bulk Upload Resi Seragam</h3>
              <p className="text-[11px] text-[#65676B]">
                {schoolName ? `Cabang: ${schoolName}` : "Format: NIS | NAMA | Resi"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {step === "input" ? (
            <div className="space-y-3">
              <div className="bg-[#F0F2F5]/70 p-3 rounded-xl border border-[#CED0D4]/60 text-xs text-[#65676B] space-y-1">
                <p className="font-semibold text-[#050505]">Petunjuk Format Input:</p>
                <p>Salin & tempel daftar resi dari Excel atau teks dengan format:</p>
                <code className="block bg-white p-2 rounded border border-[#CED0D4] font-mono text-xs text-[#050505]">
                  NIS | NAMA | Nomor Resi
                </code>
                <p className="text-[11px] text-[#65676B]">
                  Contoh: <br />
                  <span className="font-mono">12345 | Ahmad Dahlan | JNE123456789</span><br />
                  <span className="font-mono">12346 | Siti Aminah | SICEPAT987654</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Tempel Data Baris Resi
                </label>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    setValidationError(null);
                  }}
                  rows={8}
                  placeholder="NIS | NAMA | Resi..."
                  className="w-full rounded-xl border border-[#CED0D4] p-3 text-xs font-mono focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-800">Valid / Siap Simpan</div>
                  <div className="text-xl font-bold text-emerald-700">{validCount}</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-rose-800">Error / Tidak Ditemukan</div>
                  <div className="text-xl font-bold text-rose-700">{errorCount}</div>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-[#CED0D4] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F0F2F5] text-[#65676B] font-semibold sticky top-0 border-b border-[#CED0D4]">
                    <tr>
                      <th className="p-2.5">NIS</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5">No. Resi</th>
                      <th className="p-2.5">Order</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E6EB]">
                    {previewItems.map((item, idx) => (
                      <tr
                        key={idx}
                        className={
                          item.status === "valid"
                            ? "bg-emerald-50/20"
                            : item.status === "warning"
                            ? "bg-amber-50/30"
                            : "bg-rose-50/30"
                        }
                      >
                        <td className="p-2.5 font-mono font-medium">{item.nis}</td>
                        <td className="p-2.5">{item.studentName || item.name || "-"}</td>
                        <td className="p-2.5 font-mono text-[#050505]">{item.resi}</td>
                        <td className="p-2.5 font-mono text-[#65676B]">{item.orderNumber || "-"}</td>
                        <td className="p-2.5">
                          {item.status === "valid" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : item.status === "warning" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700" title={item.message}>
                              <AlertTriangle className="w-3.5 h-3.5" /> Ditimpa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700" title={item.message}>
                              <AlertCircle className="w-3.5 h-3.5" /> {item.message || "Error"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 flex items-center justify-between">
          {step === "preview" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("input")}
              className="px-4 py-2 bg-white border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] transition-colors"
            >
              Kembali ke Edit
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 bg-white border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] transition-colors"
            >
              Batal
            </button>

            {step === "input" ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleParseAndPreview}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#166FE5] transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{busy ? "Memeriksa..." : "Verifikasi & Preview"}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || validCount === 0}
                onClick={handleCommit}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{busy ? "Menyimpan..." : `Simpan ${validCount} Resi`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
