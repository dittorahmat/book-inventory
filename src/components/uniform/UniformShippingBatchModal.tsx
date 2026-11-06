import { useState } from "react";
import { X, Upload, Download, FileText } from "lucide-react";

interface UniformShippingBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (type: "packing" | "ekspedisi") => void;
  paidOnly: boolean;
  onPaidOnlyChange: (val: boolean) => void;
  importText: string;
  onImportTextChange: (val: string) => void;
  importShipped: boolean;
  onImportShippedChange: (val: boolean) => void;
  importBusy: boolean;
  importResult: string | null;
  onImport: () => void;
  hasSchoolSelected: boolean;
}

export function UniformShippingBatchModal({
  isOpen,
  onClose,
  onExport,
  paidOnly,
  onPaidOnlyChange,
  importText,
  onImportTextChange,
  importShipped,
  onImportShippedChange,
  importBusy,
  importResult,
  onImport,
  hasSchoolSelected,
}: UniformShippingBatchModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1877F2] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Batch Ekspedisi & Unduh CSV</h3>
              <p className="text-[11px] text-[#65676B]">Ekspor daftar pengiriman dan impor resi massal</p>
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

        {/* Tab switch */}
        <div className="flex border-b border-[#E4E6EB] bg-[#F0F2F5]/60 px-5 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "export"
                ? "border-[#1877F2] text-[#1877F2]"
                : "border-transparent text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "import"
                ? "border-[#1877F2] text-[#1877F2]"
                : "border-transparent text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor Resi / Ongkir</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {activeTab === "export" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Format Unduhan
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onExport("packing")}
                    className="p-3 bg-white border border-[#CED0D4] rounded-xl text-left hover:border-[#1877F2] hover:bg-blue-50/30 transition-all group active:scale-[0.98]"
                  >
                    <div className="text-xs font-bold text-[#050505] group-hover:text-[#1877F2]">CSV Packing</div>
                    <div className="text-[11px] text-[#65676B] mt-0.5">Daftar item seragam untuk gudang pengepakan</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExport("ekspedisi")}
                    className="p-3 bg-white border border-[#CED0D4] rounded-xl text-left hover:border-[#1877F2] hover:bg-blue-50/30 transition-all group active:scale-[0.98]"
                  >
                    <div className="text-xs font-bold text-[#050505] group-hover:text-[#1877F2]">CSV Ekspedisi</div>
                    <div className="text-[11px] text-[#65676B] mt-0.5">Data alamat & kontak pengiriman pihak ketiga</div>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E4E6EB]">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#050505] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paidOnly}
                    onChange={(e) => onPaidOnlyChange(e.target.checked)}
                    className="rounded text-[#1877F2] focus:ring-[#1877F2]"
                  />
                  <span>Hanya unduh order yang sudah lunas</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Data CSV (nis;resi;ongkir per baris)
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => onImportTextChange(e.target.value)}
                  rows={4}
                  placeholder="NIS123;RESI-JNE-001;18000&#10;NIS124;RESI-SICEPAT-002;20000"
                  className="w-full rounded-xl border border-[#CED0D4] p-3 text-xs font-mono focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#050505] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importShipped}
                    onChange={(e) => onImportShippedChange(e.target.checked)}
                    className="rounded text-[#1877F2] focus:ring-[#1877F2]"
                  />
                  <span>Tandai status order langsung &quot;Terkirim&quot;</span>
                </label>

                <button
                  type="button"
                  disabled={importBusy || !hasSchoolSelected}
                  onClick={onImport}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#166FE5] active:scale-[0.98] transition-colors"
                >
                  {importBusy ? "Memproses..." : "Import Data"}
                </button>
              </div>

              {!hasSchoolSelected && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ Silakan pilih cabang spesifik terlebih dahulu pada filter sekolah untuk melakukan import ekspedisi.
                </p>
              )}

              {importResult && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  {importResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] transition-colors active:scale-[0.98]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
