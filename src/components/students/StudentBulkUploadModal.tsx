import { useState } from "react";
import { X, Upload, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiEnvelope } from "../../lib/api";

interface StudentBulkUploadModalProps {
  schoolId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StudentBulkUploadModal({ schoolId, onClose, onSuccess }: StudentBulkUploadModalProps) {
  const [fileText, setFileText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const downloadSampleTemplate = () => {
    const csvContent =
      "nis,name,gradeLevel,gender,curriculumType,academicYear,parentName,parentPhone,parentEmail\n" +
      "1001,Budi Santoso,1,male,international,2026/2027,Santoso,08123456789,budi.parent@example.com\n" +
      "1002,Siti Aminah,2,female,international,2026/2027,Aminah,08129876543,siti.parent@example.com\n" +
      "1003,Rizky Pratama,3,male,national,2026/2027,Pratama,081311223344,rizky.parent@example.com\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_siswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileText(text);
    };
    reader.onerror = () => setError("Gagal membaca file yang dipilih.");
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!schoolId) {
      setError("Pilih sekolah terlebih dahulu sebelum mengimpor siswa.");
      return;
    }
    if (!fileText.trim()) {
      setError("Pilih file CSV data siswa terlebih dahulu.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const lines = fileText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length <= 1) {
        throw new Error("File CSV kosong atau hanya memiliki baris header.");
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const nisIdx = headers.indexOf("nis");
      const nameIdx = headers.indexOf("name");
      const gradeIdx = headers.indexOf("gradelevel") !== -1 ? headers.indexOf("gradelevel") : headers.indexOf("kelas");

      if (nisIdx === -1 || nameIdx === -1 || gradeIdx === -1) {
        throw new Error("Header CSV wajib memiliki kolom 'nis', 'name', dan 'gradeLevel' (atau 'kelas').");
      }

      const genderIdx = headers.indexOf("gender");
      const currIdx = headers.indexOf("curriculumtype");
      const yearIdx = headers.indexOf("academicyear");
      const pNameIdx = headers.indexOf("parentname");
      const pPhoneIdx = headers.indexOf("parentphone");
      const pEmailIdx = headers.indexOf("parentemail");

      const studentList = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const nis = cols[nisIdx];
        const name = cols[nameIdx];
        const gradeLevel = cols[gradeIdx];
        if (!nis || !name || !gradeLevel) continue;

        studentList.push({
          nis,
          name,
          gradeLevel,
          gender: genderIdx !== -1 && cols[genderIdx]?.toLowerCase() === "female" ? "female" : "male",
          curriculumType: currIdx !== -1 && cols[currIdx]?.toLowerCase() === "national" ? "national" : "international",
          academicYear: yearIdx !== -1 && cols[yearIdx] ? cols[yearIdx] : "2026/2027",
          parentName: pNameIdx !== -1 ? cols[pNameIdx] : undefined,
          parentPhone: pPhoneIdx !== -1 ? cols[pPhoneIdx] : undefined,
          parentEmail: pEmailIdx !== -1 && cols[pEmailIdx] ? cols[pEmailIdx] : undefined,
        });
      }

      if (studentList.length === 0) {
        throw new Error("Tidak ada baris data valid yang ditemukan pada file.");
      }

      const res = await apiEnvelope<{ success: boolean; message: string; data: any }>("/api/students/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          students: studentList,
        }),
      });

      setResultMsg(res.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Gagal mengimpor data siswa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6EB]">
          <div>
            <h2 className="text-sm font-bold text-[#050505] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#1877F2]" />
              Bulk Upload Data Siswa
            </h2>
            <p className="text-xs text-[#65676B]">Impor banyak siswa sekaligus via format CSV/Excel</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-[#F0F2F5] rounded-xl flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-[#050505]">Belum punya format file?</div>
            <div className="text-[#65676B]">Unduh format contoh agar nama kolom sesuai.</div>
          </div>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="px-3 py-1.5 bg-white border border-[#CED0D4] hover:bg-gray-50 active:scale-[0.98] text-[#050505] rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[#1877F2]" />
            <span>Sample CSV</span>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#050505] block">Pilih File CSV Siswa</label>
          <div className="border-2 border-dashed border-[#CED0D4] hover:border-[#1877F2] rounded-xl p-6 text-center cursor-pointer transition-all bg-white relative">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-[#65676B] mx-auto mb-2" />
            <div className="text-xs font-semibold text-[#050505]">
              {fileName || "Klik untuk memilih file CSV dari komputer"}
            </div>
            <div className="text-[11px] text-[#65676B] mt-0.5">Sistem akan otomatis upsert data jika NIS sudah ada.</div>
          </div>
        </div>

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

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E6EB]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] rounded-xl text-xs font-semibold text-[#050505] transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isSubmitting || !fileText}
            className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mengimpor...</span>
              </>
            ) : (
              <span>Mulai Impor</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
