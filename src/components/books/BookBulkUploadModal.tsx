import { useState } from "react";
import { X, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Link2, Info, Package } from "lucide-react";
import { apiEnvelope } from "../../lib/api";
import { parseBookCatalogData, type ParsedBookRow, type SkippedBookRow } from "../../lib/book-import-parser";
import { DriveFileList, type DriveFolderItem } from "../ui/DriveFileList";
import { BookImportPreview } from "./BookImportPreview";

interface BookBulkUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}


export function BookBulkUploadModal({ onClose, onSuccess }: BookBulkUploadModalProps) {
  const [activeTab, setActiveTab] = useState<"file" | "link">("file");
  const [fileName, setFileName] = useState<string>("");
  const [sheetsUrl, setSheetsUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [parsedBooks, setParsedBooks] = useState<ParsedBookRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedBookRow[]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  const [folderFiles, setFolderFiles] = useState<DriveFolderItem[]>([]);
  const [autoCreatePackages, setAutoCreatePackages] = useState<boolean>(true);
  const [academicYear, setAcademicYear] = useState<string>("2026/2027");

  const downloadSampleTemplate = () => {
    const csvContent =
      "isbn,judul,kelas,harga_jual,harga_beli,penerbit\n" +
      "978-0132350884,Clean Code,1,150000,100000,Prentice Hall\n" +
      "978-0201616224,The Pragmatic Programmer,2,175000,120000,Addison-Wesley\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_katalog_buku.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResultMsg(null);
    setFolderFiles([]);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const res = parseBookCatalogData(buffer);
      setParsedBooks(res.validBooks);
      setSkippedRows(res.skippedRows);
      setSheetName(res.sheetName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membaca berkas katalog");
      setParsedBooks([]);
      setSkippedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFetchGoogleSheets = async () => {
    if (!sheetsUrl.trim()) {
      setError("Masukkan URL Google Drive folder atau Sheets terlebih dahulu.");
      return;
    }

    setIsParsing(true);
    setError(null);
    setResultMsg(null);
    setFolderFiles([]);

    try {
      const resp = await apiEnvelope<{
        success: boolean;
        type: "folder" | "sheet";
        data: {
          files?: DriveFolderItem[];
          validBooks?: ParsedBookRow[];
          skippedRows?: SkippedBookRow[];
          sheetName?: string;
        };
      }>("/api/books/parse-drive-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetsUrl }),
      });

      if (resp.type === "folder" && resp.data.files) {
        setFolderFiles(resp.data.files);
        setFileName(`Folder Google Drive (${resp.data.files.length} berkas)`);
        setParsedBooks([]);
      } else if (resp.type === "sheet" && resp.data.validBooks) {
        setParsedBooks(resp.data.validBooks);
        setSkippedRows(resp.data.skippedRows || []);
        setSheetName(resp.data.sheetName || "");
        setFileName("Google Sheets Catalog");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memproses Google Drive URL");
      setParsedBooks([]);
      setSkippedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSelectFolderFile = async (file: DriveFolderItem) => {
    setIsParsing(true);
    setError(null);
    try {
      const fileUrl = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
      const resp = await apiEnvelope<{
        success: boolean;
        type: "sheet";
        data: {
          validBooks: ParsedBookRow[];
          skippedRows: SkippedBookRow[];
          sheetName: string;
        };
      }>("/api/books/parse-drive-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fileUrl }),
      });

      if (resp.data.validBooks) {
        setParsedBooks(resp.data.validBooks);
        setSkippedRows(resp.data.skippedRows || []);
        setSheetName(resp.data.sheetName || "");
        setFileName(file.name);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Gagal memuat berkas ${file.name}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    if (parsedBooks.length === 0) {
      setError("Belum ada data buku valid untuk diimpor.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const CHUNK_SIZE = 50;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalPackages = 0;

      for (let i = 0; i < parsedBooks.length; i += CHUNK_SIZE) {
        const batch = parsedBooks.slice(i, i + CHUNK_SIZE);
        const res = await apiEnvelope<{
          success: boolean;
          message: string;
          data: { insertedCount: number; updatedCount: number; packagesCreatedCount?: number };
        }>("/api/books/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            books: batch,
            autoCreatePackages,
            academicYear,
          }),
        });

        if (res.data) {
          totalInserted += res.data.insertedCount;
          totalUpdated += res.data.updatedCount;
          totalPackages += res.data.packagesCreatedCount || 0;
        }
      }

      const pkgNote = totalPackages > 0 ? ` & ${totalPackages} paket dibuat` : "";
      setResultMsg(`Berhasil mengimpor ${parsedBooks.length} buku! (${totalInserted} baru, ${totalUpdated} diperbarui${pkgNote}).`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor katalog buku.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#E4E6EB] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#050505] flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#1877F2]" />
              Bulk Upload Katalog Buku
            </h2>
            <p className="text-xs text-[#65676B]">Impor banyak judul buku dari Excel (.xlsx / .xlsm), CSV, atau Folder Google Drive</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="p-3 bg-[#F0F2F5] rounded-xl flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-[#050505]">Format Katalog Fleksibel</div>
              <div className="text-[#65676B]">Mendukung multi-sheet kelas numerik dan folder Google Drive Al-Wildan.</div>
            </div>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="px-3 py-1.5 bg-white border border-[#CED0D4] hover:bg-gray-50 active:scale-[0.98] text-[#050505] rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Format CSV</span>
            </button>
          </div>

          <div className="flex border-b border-[#E4E6EB] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("file")}
              className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === "file" ? "border-[#1877F2] text-[#1877F2]" : "border-transparent text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Upload Berkas (.xlsx / .xlsm / .csv)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("link")}
              className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === "link" ? "border-[#1877F2] text-[#1877F2]" : "border-transparent text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <Link2 className="w-4 h-4" />
              Link Google Sheets / Drive Folder
            </button>
          </div>

          {activeTab === "file" ? (
            <div className="space-y-2">
              <div className="border-2 border-dashed border-[#CED0D4] hover:border-[#1877F2] rounded-xl p-6 text-center cursor-pointer transition-all bg-white relative">
                <input type="file" accept=".xlsx,.xlsm,.xls,.csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className="w-8 h-8 text-[#65676B] mx-auto mb-2" />
                <div className="text-xs font-semibold text-[#050505]">
                  {fileName || "Klik atau drag & drop file Excel / CSV katalog buku"}
                </div>
                <div className="text-[11px] text-[#65676B] mt-0.5">Format didukung: .xlsm, .xlsx, .csv (Multi-sheet kelas otomatis terbaca)</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#050505] block">Tautan Google Sheets atau Folder Google Drive Publik</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... atau https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3 py-2 text-xs border border-[#CED0D4] rounded-xl focus:outline-none focus:border-[#1877F2]"
                />
                <button
                  type="button"
                  onClick={handleFetchGoogleSheets}
                  disabled={isParsing || !sheetsUrl}
                  className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] active:scale-[0.98] text-[#050505] text-xs font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Muat Data"}
                </button>
              </div>
              <div className="text-[11px] text-[#65676B] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
                Dapat berupa link satu Google Sheets atau link folder Google Drive yang memuat banyak file katalog.
              </div>
            </div>
          )}

          {/* Opsi Auto-Bundling BOM Paket */}
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#050505]">
              <input
                type="checkbox"
                checked={autoCreatePackages}
                onChange={(e) => setAutoCreatePackages(e.target.checked)}
                className="w-4 h-4 text-[#1877F2] rounded focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#1877F2]" />
                Otomatis buat Paket Bundling Buku (BOM) per Tingkat Kelas
              </span>
            </label>
            {autoCreatePackages && (
              <div className="flex items-center gap-2 text-xs pt-1">
                <span className="text-[#65676B]">Tahun Ajaran Paket:</span>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="px-2 py-1 text-xs border border-[#CED0D4] rounded-lg w-28 bg-white font-medium"
                />
              </div>
            )}
          </div>

          {folderFiles.length > 0 && (
            <DriveFileList files={folderFiles} onSelect={handleSelectFolderFile} />
          )}

          {isParsing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Sedang membaca data katalog buku...</span>
            </div>
          )}

          <BookImportPreview parsedBooks={parsedBooks} sheetName={sheetName} />


          {skippedRows.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-800">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                {skippedRows.length} baris dilewati (duplikat atau judul kosong):
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-700">
                {skippedRows.slice(0, 3).map((sk) => (
                  <li key={sk.rowNumber}>
                    Baris {sk.rowNumber}: {sk.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resultMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{resultMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] active:scale-[0.98] rounded-xl text-xs font-semibold text-[#050505] transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isSubmitting || parsedBooks.length === 0}
            className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan ke Katalog...</span>
              </>
            ) : (
              <span>Simpan {parsedBooks.length > 0 ? `${parsedBooks.length} Buku` : ""}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

