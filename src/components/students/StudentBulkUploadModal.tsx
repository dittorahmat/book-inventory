import { useState } from "react";
import { X, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Link2, Info } from "lucide-react";
import { apiEnvelope } from "../../lib/api";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { SchoolOption } from "./students-api";
import { StudentImportPreview } from "./StudentImportPreview";
import { normalizeGoogleSheetsUrl } from "../../lib/sheets";
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

  const downloadSampleTemplate = () => {
    const csvContent =
      "nis,nama,kelas,jk,tahun_ajaran\n" +
      "262710001,ABIZAR ZAFRAN BINTORO,1.INTER 1,Male,2026/2027\n" +
      "262710002,ABQARY SALAHUDDIN WIBOWO,1.INTER 1,Male,2026/2027\n" +
      "262710003,FATIMAH AZZAHRA,2.MQ 1,Female,2026/2027\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_siswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResultMsg(null);
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
      setError("Masukkan URL Google Sheets terlebih dahulu.");
      return;
    }

    const exportUrl = normalizeGoogleSheetsUrl(sheetsUrl);
    if (!exportUrl) {
      setError("URL tidak valid. Pastikan link berasal dari Google Sheets (docs.google.com/spreadsheets/d/...).");
      return;
    }

    setIsParsing(true);
    setError(null);
    setResultMsg(null);

    try {
      const resp = await fetch(exportUrl);
      if (!resp.ok) {
        throw new Error("Gagal mengunduh spreadsheet. Pastikan akses Google Sheets diatur publik (view).");
      }
      const csvText = await resp.text();
      const res = parseStudentData(csvText);
      setParsedStudents(res.validStudents);
      setSkippedRows(res.skippedRows);
      setSheetName(res.sheetName);
      setFileName("Google Sheets Data");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memproses Google Sheets");
      setParsedStudents([]);
      setSkippedRows([]);
    } finally {
      setIsParsing(false);
    }
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

      const CHUNK_SIZE = 100;
      let totalInserted = 0;
      let totalUpdated = 0;

      for (let i = 0; i < parsedStudents.length; i += CHUNK_SIZE) {
        const batch = parsedStudents.slice(i, i + CHUNK_SIZE);
        const res = await apiEnvelope<{
          success: boolean;
          message: string;
          data: { insertedCount: number; updatedCount: number };
        }>("/api/students/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId: selectedSchoolId, students: batch }),
        });

        if (res.data) {
          totalInserted += res.data.insertedCount;
          totalUpdated += res.data.updatedCount;
        }
      }

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
              onClick={downloadSampleTemplate}
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
              Link Google Sheets
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
              <label className="text-xs font-semibold text-[#050505] block">Tautan Google Sheets Publik</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3 py-2 text-xs border border-[#CED0D4] rounded-xl focus:outline-none focus:border-[#1877F2]"
                />
                <button
                  type="button"
                  onClick={handleFetchGoogleSheets}
                  disabled={isParsing || !sheetsUrl}
                  className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] active:scale-[0.98] text-[#050505] text-xs font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Muat Data"}
                </button>
              </div>
              <div className="text-[11px] text-[#65676B] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#1877F2]" />
                Pastikan akses berbagi disetel ke "Siapa saja yang memiliki link".
              </div>
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
