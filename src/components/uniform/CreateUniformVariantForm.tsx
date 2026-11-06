import { useState, useRef } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { createUniformVariant } from "./uniform-admin-api";

interface CreateUniformVariantFormProps {
  busy: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

interface UniformVariantDraft {
  code: string;
  name: string;
  kind: string;
  gender: string;
  jenjang: string;
  year: string;
  price: string;
  sizes: string;
  chartUrl: string;
}

const INITIAL_DRAFT: UniformVariantDraft = {
  code: "",
  name: "",
  kind: "kain_harian",
  gender: "male",
  jenjang: "sd",
  year: "2026/2027",
  price: "0",
  sizes: "",
  chartUrl: "",
};

const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

export function CreateUniformVariantForm({
  busy,
  onSuccess,
  onError,
  onCancel,
}: CreateUniformVariantFormProps) {
  const [draft, setDraft] = useState<UniformVariantDraft>(INITIAL_DRAFT);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof UniformVariantDraft>(field: K, val: UniformVariantDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: val }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    const errors: Record<string, string | undefined> = {};
    if (!draft.code.trim()) {
      errors.code = "Kode varian wajib diisi.";
    }
    if (!draft.name.trim()) {
      errors.name = "Nama varian wajib diisi.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.code) {
        codeInputRef.current?.focus();
      } else if (errors.name) {
        nameInputRef.current?.focus();
      }
      return;
    }

    setFormErrors({});

    try {
      await createUniformVariant({
        code: draft.code.trim(),
        name: draft.name.trim(),
        kind: draft.kind,
        gender: draft.gender,
        jenjang: draft.jenjang,
        academicYear: draft.year.trim(),
        price: Number(draft.price) || 0,
        sizeChartUrl: draft.chartUrl.trim() || undefined,
        sizes: draft.kind === "olahraga" ? draft.sizes.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      onSuccess("Varian seragam baru berhasil didaftarkan.");
      setDraft(INITIAL_DRAFT);
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

      <FormSummaryAlert errors={formErrors} title="Formulir Belum Lengkap" />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Kode *</label>
          <input
            ref={codeInputRef}
            value={draft.code}
            onChange={(e) => updateField("code", e.target.value)}
            placeholder="Misal: KAIN-SD-PUTRA"
            className={`w-full rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none transition-colors ${
              formErrors.code
                ? "border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-500"
                : "border-[#CED0D4] focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
            }`}
          />
          <FormFieldFeedback error={formErrors.code} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Nama Varian *</label>
          <input
            ref={nameInputRef}
            value={draft.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Misal: Kain Seragam Harian Putra SD"
            className={`w-full rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none transition-colors ${
              formErrors.name
                ? "border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-500"
                : "border-[#CED0D4] focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
            }`}
          />
          <FormFieldFeedback error={formErrors.name} />
        </div>
        <div>
          <SearchableSingleSelect
            label="Jenis"
            options={[
              { value: "kain_harian", label: "Kain harian" },
              { value: "olahraga", label: "Olahraga jadi" },
            ]}
            value={draft.kind}
            onChange={(val) => updateField("kind", val)}
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
            value={draft.gender}
            onChange={(val) => updateField("gender", val)}
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
            value={draft.jenjang}
            onChange={(val) => updateField("jenjang", val)}
            placeholder="Pilih jenjang..."
          />
        </div>
        <div>
          <label className={labelCls}>Tahun ajaran</label>
          <input
            value={draft.year}
            onChange={(e) => updateField("year", e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
          />
        </div>
        <div>
          <label className={labelCls}>Harga (Rp)</label>
          <input
            value={draft.price}
            inputMode="numeric"
            onChange={(e) => updateField("price", e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
          />
        </div>
        <div>
          <label className={labelCls}>Size chart URL</label>
          <input
            value={draft.chartUrl}
            onChange={(e) => updateField("chartUrl", e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
          />
        </div>
        {draft.kind === "olahraga" && (
          <div className="sm:col-span-3">
            <label className={labelCls}>Daftar Size (pisahkan dengan koma)</label>
            <input
              value={draft.sizes}
              onChange={(e) => updateField("sizes", e.target.value)}
              placeholder="Contoh: S, M, L, XL, XXL"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
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
