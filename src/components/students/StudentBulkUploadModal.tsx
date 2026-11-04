import { useState } from "react";
import { X, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Link2, Info } from "lucide-react";
import { apiEnvelope } from "../../lib/api";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { SchoolOption } from "./students-api";
import { StudentImportPreview } from "./StudentImportPreview";
import { DriveFileList, type DriveFolderItem } from "../ui/DriveFileList";
import { DriveFolderBatchRunner } from "../ui/DriveFolderBatchRunner";
import { downloadSampleStudentTemplate, submitStudentsInChunks } from "./student-import-helpers";
import {
  parseStudentData,
  type ParsedStudentRow,
  type SkippedStudentRow,
} from "../../lib/student-import-parser";

interface StudentBulkUploadModalProps {
  schoolId: string | null;
  schools?: SchoolOption[];
  onClose: () => void;
  onSuccess: () => void;
}


export function StudentBulkUploadModal({
  schoolId: initialSchoolId,
  schools = [],
  onClose,
  onSuccess,
}: StudentBulkUploadModalProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    initialSchoolId && initialSchoolId !== "all" ? initialSchoolId : ""
  );
  const [activeTab, setActiveTab] = useState<"file" | "link">("file");
  const [fileName, setFileName] = useState<string>("");
  const [sheetsUrl, setSheetsUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [parsedStudents, setParsedStudents] = useState<ParsedStudentRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedStudentRow[]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  const [folderFiles, setFolderFiles] = useState<DriveFolderItem[]>([]);

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
      const res = parseStudentData(buffer);
      setParsedStudents(res.validStudents);
      setSkippedRows(res.skippedRows);
      setSheetName(res.sheetName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memproses berkas");
      setParsedStudents([]);
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
          validStudents?: ParsedStudentRow[];
          skippedRows?: SkippedStudentRow[];
          sheetName?: string;
        };
      }>("/api/students/parse-drive-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetsUrl }),
      });

      if (resp.type === "folder" && resp.data.files) {
        setFolderFiles(resp.data.files);
        setFileName(`Folder Google Drive (${resp.data.files.length} berkas)`);
        setParsedStudents([]);
      } else if (resp.type === "sheet" && resp.data.validStudents) {
        setParsedStudents(resp.data.validStudents);
        setSkippedRows(resp.data.skippedRows || []);
        setSheetName(resp.data.sheetName || "");
        setFileName("Google Sheets Data");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memproses Google Drive URL");
      setParsedStudents([]);
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
          validStudents: ParsedStudentRow[];
          skippedRows: SkippedStudentRow[];
          sheetName: string;
        };
      }>("/api/students/parse-drive-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fileUrl }),
      });

      if (resp.data.validStudents) {
        setParsedStudents(resp.data.validStudents);
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

  const handleBatchProcessFile = async (file: DriveFolderItem) => {
    const fileUrl = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
    const resp = await apiEnvelope<{
      success: boolean;
      type: "sheet";
      data: {
        validStudents: ParsedStudentRow[];
        skippedRows: SkippedStudentRow[];
        sheetName: string;
      };
    }>("/api/students/parse-drive-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fileUrl }),
    });

    const newStudents = resp.data.validStudents || [];
    if (newStudents.length === 0) {
      return { count: 0, warning: "Tidak ada baris siswa valid" };
    }

    setParsedStudents((prev) => {
      const existingNis = new Set(prev.map((s) => s.nis));
      const nonDuplicate = newStudents.filter((s) => !existingNis.has(s.nis));
      return [...prev, ...nonDuplicate];
    });

    if (resp.data.skippedRows?.length) {
      setSkippedRows((prev) => [...prev, ...resp.data.skippedRows]);
    }

    return { count: newStudents.length };
  };

  const handleUpload = async () => {
    if (!selectedSchoolId) {
      setError("Pilih sekolah cabang tujuan terlebih dahulu sebelum mengimpor siswa.");
      return;
    }
    if (parsedStudents.length === 0) {
      setError("Belum ada data siswa valid untuk diimpor. Periksa berkas atau tautan Anda.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const { totalInserted, totalUpdated } = await submitStudentsInChunks({
        schoolId: selectedSchoolId,
        students: parsedStudents,
      });

      setResultMsg(`Berhasil mengimpor ${parsedStudents.length} siswa! (${totalInserted} baru, ${totalUpdated} diperbarui).`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor data siswa.");
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
              Bulk Upload Data Siswa
            </h2>
            <p className="text-xs text-[#65676B]">Impor banyak murid dari file Excel (.xlsx / .xlsm), CSV, atau Google Sheets</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="p-3 bg-[#F0F2F5] rounded-xl flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-[#050505]">Format Standar Sekolah Didukung</div>
              <div className="text-[#65676B]">Mendukung file Excel langsung dengan sheet `DT-SSW` & format kelas Al-Wildan.</div>
            </div>
            <button
              type="button"
              onClick={downloadSampleStudentTemplate}
              className="px-3 py-1.5 bg-white border border-[#CED0D4] hover:bg-gray-50 active:scale-[0.98] text-[#050505] rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Format CSV</span>
            </button>
          </div>

          {(!initialSchoolId || initialSchoolId === "all") && schools.length > 0 && (
            <div className="space-y-1">
              <SearchableSingleSelect
                label="Sekolah Cabang Tujuan"
                options={schools.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
                value={selectedSchoolId}
                onChange={setSelectedSchoolId}
                placeholder="Pilih cabang sekolah murid..."
                required
              />
            </div>
          )}

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
                  {fileName || "Klik atau drag & drop file Excel / CSV ke sini"}
                </div>
                <div className="text-[11px] text-[#65676B] mt-0.5">Format didukung: .xlsm, .xlsx, .csv</div>
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
                Dapat berupa link spreadsheet tunggal atau link folder Google Drive publik.
              </div>
            </div>
          )}

          {folderFiles.length > 0 && (
            <div className="space-y-3">
              <DriveFolderBatchRunner
                files={folderFiles}
                onProcessFile={handleBatchProcessFile}
                onComplete={() => {
                  setFileName(`Semua Berkas Folder (${folderFiles.length} file)`);
                }}
                title="Proses Semua Berkas Siswa di Folder"
              />
              <DriveFileList files={folderFiles} onSelect={handleSelectFolderFile} />
            </div>
          )}

          {isParsing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Sedang memproses dan memetakan kolom data...</span>
            </div>
          )}


          <StudentImportPreview parsedStudents={parsedStudents} skippedRows={skippedRows} sheetName={sheetName} />

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
            disabled={isSubmitting || parsedStudents.length === 0}
            className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <span>Simpan {parsedStudents.length > 0 ? `${parsedStudents.length} Siswa` : ""}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
