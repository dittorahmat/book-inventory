import { useState, useRef } from "react";
import { X, Upload, CheckCircle2, Loader2, FileSpreadsheet, Link2, ArrowLeft, ArrowRight } from "lucide-react";
import { postJson } from "../../lib/api";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { SupplierMappingPreviewStep } from "./SupplierMappingPreviewStep";
import { SupplierMappingDoneStep } from "./SupplierMappingDoneStep";

interface SupplierMappingModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export interface SupplierProcessedItem {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  sheet: string;
  isNew: boolean;
  booksMatchedCount?: number;
  sampleBooks?: string[];
}

interface MappingResult {
  suppliersUpserted: number;
  booksMatched: number;
  newLinksCount: number;
  totalSheetsProcessed: number;
  processedSuppliers?: SupplierProcessedItem[];
}

interface PreviewResult {
  totalSheetsFound: number;
  totalSheetsProcessed: number;
  totalBooksMatched: number;
  suppliers: SupplierProcessedItem[];
}

export function SupplierMappingModal({ onClose, onSuccess }: SupplierMappingModalProps) {
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [activeTab, setActiveTab] = useState<"link" | "file">("link");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<MappingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPayload = async (): Promise<{ url?: string; fileBase64?: string } | null> => {
    if (activeTab === "link") {
      if (!sheetsUrl.trim()) {
        setError("Harap masukkan tautan Google Spreadsheet estimasi PO vendor.");
        return null;
      }
      return { url: sheetsUrl.trim() };
    }
    if (!file) {
      setError("Harap pilih berkas spreadsheet .xlsx / .xls.");
      return null;
    }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const resultStr = String(reader.result || "");
          const commaIndex = resultStr.indexOf(",");
          resolve(commaIndex >= 0 ? resultStr.slice(commaIndex + 1) : resultStr);
        };
        reader.onerror = () => reject(new Error("Gagal membaca berkas spreadsheet."));
        reader.readAsDataURL(file);
      });
      return { fileBase64: base64 };
    } catch {
      setError("Gagal membaca berkas spreadsheet.");
      return null;
    }
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = await getPayload();
    if (!payload) return;

    try {
      setIsLoadingPreview(true);
      const res = await postJson<PreviewResult>(
        "/api/procurement/suppliers/preview-mapping",
        payload,
        "Gagal memverifikasi berkas spreadsheet."
      );
      if (res) {
        setPreview(res);
        setStep("preview");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memverifikasi data.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmImport = async () => {
    setError(null);
    const payload = await getPayload();
    if (!payload) return;

    try {
      setIsSubmitting(true);
      const res = await postJson<MappingResult>(
        "/api/procurement/suppliers/import-mapping",
        payload,
        "Gagal memproses pemetaan supplier."
      );
      if (res) {
        setResult(res);
        setStep("done");
        onSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] w-full max-w-xl overflow-hidden shadow-xl animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E6EB] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#1877F2] rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#050505]">Import & Mapping Supplier Buku</h2>
              <p className="text-[11px] text-[#65676B]">
                {step === "input" && "Langkah 1: Masukkan sumber berkas spreadsheet"}
                {step === "preview" && "Langkah 2: Verifikasi & review data sebelum disimpan"}
                {step === "done" && "Selesai: Pemetaan berhasil disinkronkan"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-4 h-4 text-[#65676B]" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && <FormSummaryAlert errors={{ general: error }} title="Pemberitahuan" />}

          {step === "input" && (
            <form onSubmit={handlePreview} id="supplier-mapping-form" className="space-y-4">
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
                    onChange={(e) => {
                      setSheetsUrl(e.target.value);
                      setError(null);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/141ecGw58.../edit"
                    className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] focus:outline-hidden ${
                      error && !sheetsUrl.trim() ? "border-rose-500 ring-1 ring-rose-200" : "border-[#CED0D4] focus:border-[#1877F2]"
                    }`}
                  />
                  <FormFieldFeedback error={error && !sheetsUrl.trim() ? error : undefined} />
                  <p className="mt-1 text-[11px] text-[#65676B]">
                    File spreadsheet Estimasi PO Distributor yang memuat sheet vendor (CNL, Mentari, Pelangi, Erlangga, dll).
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
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                        setError(null);
                      }
                    }}
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
            </form>
          )}

          {step === "preview" && preview && (
            <SupplierMappingPreviewStep
              totalSheetsProcessed={preview.totalSheetsProcessed}
              totalSuppliers={preview.suppliers.length}
              totalBooksMatched={preview.totalBooksMatched}
              suppliers={preview.suppliers}
            />
          )}

          {step === "done" && result && (
            <SupplierMappingDoneStep
              booksMatched={result.booksMatched}
              totalSheetsProcessed={result.totalSheetsProcessed}
              newLinksCount={result.newLinksCount}
              suppliersUpserted={result.suppliersUpserted}
              processedSuppliers={result.processedSuppliers}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 shrink-0">
          {step === "preview" ? (
            <button
              type="button"
              onClick={() => setStep("input")}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-[#050505] hover:bg-[#E4E6EB] rounded-xl transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoadingPreview || isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-[#050505] hover:bg-[#E4E6EB] rounded-xl transition-all active:scale-[0.98]"
            >
              {step === "done" ? "Tutup" : "Batal"}
            </button>

            {step === "input" && (
              <button
                type="submit"
                form="supplier-mapping-form"
                disabled={isLoadingPreview}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white text-xs font-semibold rounded-xl hover:bg-[#166FE5] disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memeriksa Berkas...
                  </>
                ) : (
                  <>
                    <span>Muat & Review Data</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}

            {step === "preview" && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white text-xs font-semibold rounded-xl hover:bg-[#166FE5] disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Simpan & Terapkan Pemetaan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
