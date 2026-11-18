import { useState } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Package } from "lucide-react";
import * as XLSX from "xlsx";
import { formatRupiah } from "../../lib/transfer-pricing";
import { currentAcademicYear } from "../../lib/wib-time";
import {
  previewBulkUniformCatalog,
  commitBulkUniformCatalog,
  type BulkCatalogPreviewResult,
} from "./uniform-admin-api";
import { UNIFORM_INPUT_CLS } from "./uniform-styles";

interface UniformBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UniformBulkUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: UniformBulkUploadModalProps) {
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [academicYear, setAcademicYear] = useState(() => currentAcademicYear());
  const [autoBundlePackages, setAutoBundlePackages] = useState(true);

  const [previewResult, setPreviewResult] = useState<BulkCatalogPreviewResult | null>(null);
  const [isParsing, setIsParsingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    setPreviewResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsingFile(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (!rows || rows.length === 0) {
        throw new Error("Berkas Excel kosong.");
      }

      setRawRows(rows);
      const res = await previewBulkUniformCatalog({
        rows,
        academicYear,
        autoBundlePackages,
      });

      setPreviewResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca berkas Excel.");
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleCommit = async () => {
    if (rawRows.length === 0) {
      setError("Pilih berkas Excel terlebih dahulu.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await commitBulkUniformCatalog({
        rows: rawRows,
        academicYear,
        autoBundlePackages,
      });

      setSuccessMsg(res.message);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor katalog seragam.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl border border-[#E4E6EB] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#050505] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#1877F2]" />
              Bulk Upload Master Katalog Seragam (.xlsx)
            </h3>
            <p className="text-xs text-[#65676B] mt-0.5">
              Impor master varian seragam, ukuran, dan perakitan default paket dari spreadsheet Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Opsi Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#050505] mb-1">
                Tahun Ajaran
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                className={UNIFORM_INPUT_CLS}
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#050505] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBundlePackages}
                  onChange={(e) => setAutoBundlePackages(e.target.checked)}
                  className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2] w-4 h-4"
                />
                Otomatis buat & bundel paket seragam harian
              </label>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="relative border-2 border-dashed border-[#CED0D4] hover:border-[#1877F2] rounded-xl p-6 text-center transition-colors bg-[#F0F2F5]/40 hover:bg-white">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="w-8 h-8 text-[#1877F2]" />
              <div className="text-xs font-bold text-[#050505]">
                {fileName ? fileName : "Pilih atau Seret Berkas Excel (.xlsx / .xls)"}
              </div>
              <p className="text-[11px] text-[#65676B]">
                Mendukung template format sheet: Kolom A (Jenjang & Gender), Kolom B (Nama Varian), Kolom C (Harga)
              </p>
            </div>
          </div>

          {isParsing && (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-[#65676B]">
              <Loader2 className="w-4 h-4 animate-spin text-[#1877F2]" />
              <span>Memproses pratinjau data spreadsheet...</span>
            </div>
          )}

          {/* Pratinjau Hasil */}
          {previewResult && !isParsing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-[#F0F2F5] rounded-xl text-center">
                  <div className="text-[11px] text-[#65676B]">Total Varian</div>
                  <div className="text-sm font-bold text-[#050505]">{previewResult.summary.totalVariants}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-center">
                  <div className="text-[11px] text-emerald-700">Varian Baru</div>
                  <div className="text-sm font-bold text-emerald-700">{previewResult.summary.newVariantsCount}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <div className="text-[11px] text-[#1877F2]">Varian Update</div>
                  <div className="text-sm font-bold text-[#1877F2]">{previewResult.summary.updateVariantsCount}</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-center">
                  <div className="text-[11px] text-amber-700">Paket Terbentuk</div>
                  <div className="text-sm font-bold text-amber-700">{previewResult.summary.totalPackages}</div>
                </div>
              </div>

              {previewResult.packages.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#050505] mb-2 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-600" />
                    Paket Seragam Harian yang Akan Dibundel ({previewResult.packages.length})
                  </h4>
                  <div className="max-h-36 overflow-y-auto border border-[#E4E6EB] rounded-xl divide-y divide-[#E4E6EB] text-xs">
                    {previewResult.packages.map((pkg) => (
                      <div key={pkg.code} className="p-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#050505]">{pkg.name}</div>
                          <div className="text-[10px] text-[#65676B]">{pkg.code} • {pkg.items.length} item bahan</div>
                        </div>
                        <div className="font-semibold text-[#1877F2]">{formatRupiah(pkg.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#050505] bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] rounded-xl transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleCommit}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1877F2] hover:bg-[#166FE5] rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan ke Katalog</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
