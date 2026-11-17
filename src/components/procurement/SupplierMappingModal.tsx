import { useState, useRef } from "react";
import { X, Upload, CheckCircle2, Loader2, FileSpreadsheet, Link2 } from "lucide-react";
import { postJson } from "../../lib/api";
import { FormSummaryAlert } from "../ui/FormFieldFeedback";

interface SupplierMappingModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface MappingResult {
  suppliersUpserted: number;
  booksMatched: number;
  newLinksCount: number;
  totalSheetsProcessed: number;
}

export function SupplierMappingModal({ onClose, onSuccess }: SupplierMappingModalProps) {
  const [activeTab, setActiveTab] = useState<"link" | "file">("link");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MappingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    let payload: { url?: string; fileBase64?: string } = {};

    if (activeTab === "link") {
      if (!sheetsUrl.trim()) {
        setError("Harap masukkan tautan Google Spreadsheet estimasi PO vendor.");
        return;
      }
      payload = { url: sheetsUrl.trim() };
    } else {
      if (!file) {
        setError("Harap pilih berkas spreadsheet .xlsx / .xls.");
        return;
      }
      try {
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        payload = { fileBase64: btoa(binary) };
      } catch {
        setError("Gagal membaca berkas spreadsheet.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await postJson<{ success: boolean; data: MappingResult }>(
        "/api/procurement/suppliers/import-mapping",
        payload,
        "Gagal memproses pemetaan supplier."
      );
      if (res.data) {
        setResult(res.data);
        onSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] w-full max-w-lg overflow-hidden shadow-xl animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E6EB]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#1877F2] rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#050505]">Import & Mapping Supplier Buku</h2>
              <p className="text-[11px] text-[#65676B]">Sinkronkan supplier & relasi buku dari file Estimasi PO</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-4 h-4 text-[#65676B]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex border-b border-[#E4E6EB]">
            <button
              type="button"
              onClick={() => setActiveTab("link")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === "link"
                  ? "border-[#1877F2] text-[#1877F2]"
                  : "border-transparent text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Tautan Google Sheets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("file")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === "file"
                  ? "border-[#1877F2] text-[#1877F2]"
                  : "border-transparent text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah Berkas Excel
            </button>
          </div>

          {activeTab === "link" ? (
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Tautan Google Sheets Estimasi PO
              </label>
              <input
                type="url"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/141ecGw58.../edit"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
              <p className="mt-1 text-[11px] text-[#65676B]">
                Masukkan URL file spreadsheet Estimasi PO Distributor yang memuat sheet CNL, Mentari, Pelangi, Erlangga, dll.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Pilih Berkas Excel (.xlsx / .xls)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#CED0D4] rounded-xl p-6 text-center cursor-pointer hover:bg-[#F0F2F5] transition-colors"
              >
                <Upload className="w-6 h-6 text-[#65676B] mx-auto mb-2" />
                <span className="text-xs font-semibold text-[#1877F2]">
                  {file ? file.name : "Klik untuk memilih berkas"}
                </span>
                <p className="text-[11px] text-[#65676B] mt-0.5">Maksimal ukuran berkas 20MB</p>
              </div>
            </div>
          )}

          {error && <FormSummaryAlert errors={{ general: error }} title="Gagal Memproses Data" />}

          {result && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Pemetaan Berhasil Disinkronkan!</span>
              </div>
              <p className="text-[11px]">
                {result.booksMatched} buku terpetakan dari {result.totalSheetsProcessed} sheet vendor. ({result.suppliersUpserted} supplier baru didaftarkan).
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] rounded-xl transition-colors"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white text-xs font-semibold rounded-xl hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Mulai Sinkronisasi"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
