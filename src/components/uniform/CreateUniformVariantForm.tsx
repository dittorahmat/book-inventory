import { useState } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback } from "../ui/FormFieldFeedback";
import { createUniformVariant } from "./uniform-admin-api";

interface CreateUniformVariantFormProps {
  busy: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]";
const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

export function CreateUniformVariantForm({
  busy,
  onSuccess,
  onError,
  onCancel,
}: CreateUniformVariantFormProps) {
  const [vCode, setVCode] = useState("");
  const [vName, setVName] = useState("");
  const [vKind, setVKind] = useState("kain_harian");
  const [vGender, setVGender] = useState("male");
  const [vJenjang, setVJenjang] = useState("sd");
  const [vYear, setVYear] = useState("2026/2027");
  const [vPrice, setVPrice] = useState("0");
  const [vSizes, setVSizes] = useState("");
  const [vChart, setVChart] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!vCode.trim()) {
      setValidationError("Kode varian wajib diisi.");
      return;
    }
    if (!vName.trim()) {
      setValidationError("Nama varian wajib diisi.");
      return;
    }
    setValidationError(null);

    try {
      await createUniformVariant({
        code: vCode.trim(),
        name: vName.trim(),
        kind: vKind,
        gender: vGender,
        jenjang: vJenjang,
        academicYear: vYear.trim(),
        price: Number(vPrice) || 0,
        sizeChartUrl: vChart.trim() || undefined,
        sizes: vKind === "olahraga" ? vSizes.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      onSuccess("Varian seragam baru berhasil didaftarkan.");
      setVCode("");
      setVName("");
      setVSizes("");
      setVChart("");
      setVPrice("0");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal menyimpan varian baru.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 space-y-4 shadow-xs">
      <div>
        <h3 className="text-sm font-bold text-[#050505]">Tambah Varian Seragam</h3>
        <p className="text-xs text-[#65676B] mt-0.5">Daftarkan kain harian atau seragam olahraga baru ke dalam katalog sekolah.</p>
      </div>

      {validationError && (
        <FormFieldFeedback error={validationError} />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Kode *</label>
          <input
            value={vCode}
            onChange={(e) => setVCode(e.target.value)}
            placeholder="Misal: KAIN-SD-PUTRA"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Nama Varian *</label>
          <input
            value={vName}
            onChange={(e) => setVName(e.target.value)}
            placeholder="Misal: Kain Seragam Harian Putra SD"
            className={inputCls}
          />
        </div>
        <div>
          <SearchableSingleSelect
            label="Jenis"
            options={[
              { value: "kain_harian", label: "Kain harian" },
              { value: "olahraga", label: "Olahraga jadi" },
            ]}
            value={vKind}
            onChange={setVKind}
            placeholder="Pilih jenis..."
          />
        </div>
        <div>
          <SearchableSingleSelect
            label="Gender"
            options={[
              { value: "male", label: "Laki-laki" },
              { value: "female", label: "Perempuan" },
            ]}
            value={vGender}
            onChange={setVGender}
            placeholder="Pilih gender..."
          />
        </div>
        <div>
          <SearchableSingleSelect
            label="Jenjang"
            options={[
              { value: "tk", label: "TK" },
              { value: "sd", label: "SD" },
              { value: "smp", label: "SMP" },
              { value: "sma", label: "SMA" },
            ]}
            value={vJenjang}
            onChange={setVJenjang}
            placeholder="Pilih jenjang..."
          />
        </div>
        <div>
          <label className={labelCls}>Tahun ajaran</label>
          <input value={vYear} onChange={(e) => setVYear(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Harga (Rp)</label>
          <input value={vPrice} inputMode="numeric" onChange={(e) => setVPrice(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Size chart URL</label>
          <input value={vChart} onChange={(e) => setVChart(e.target.value)} placeholder="https://..." className={inputCls} />
        </div>
        {vKind === "olahraga" && (
          <div className="sm:col-span-3">
            <label className={labelCls}>Daftar Size (pisahkan dengan koma)</label>
            <input
              value={vSizes}
              onChange={(e) => setVSizes(e.target.value)}
              placeholder="Contoh: S, M, L, XL, XXL"
              className={inputCls}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={handleSubmit}
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98] transition-colors"
        >
          Simpan Varian
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="px-4 py-2.5 border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98] transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
