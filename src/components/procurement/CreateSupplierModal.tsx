import { useState } from "react";
import { Building2, X } from "lucide-react";
import { postJson } from "../../lib/api";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import {
  validateEmail,
  validatePhone,
  validateRequiredText,
} from "../../lib/form-validation";

interface CreateSupplierModalProps {
  onClose: () => void;
  onCreated: (newSupplierId: string) => void | Promise<void>;
  defaultType?: "book" | "uniform" | "all";
  title?: string;
  codePlaceholder?: string;
  namePlaceholder?: string;
}

/** Modal pendaftaran supplier baru. */
export function CreateSupplierModal({
  onClose,
  onCreated,
  defaultType = "book",
  title = "Tambah Vendor / Supplier Baru",
  codePlaceholder = "mis. ERL, YUD",
  namePlaceholder = "mis. PT Penerbit Erlangga",
}: CreateSupplierModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"book" | "uniform" | "all">(defaultType);
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [attempted, setAttempted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttempted(true);

    const errors: Record<string, string | undefined> = {};
    const codeCheck = validateRequiredText(code, "Kode Supplier", 2);
    if (!codeCheck.valid) errors.code = codeCheck.message;

    const nameCheck = validateRequiredText(name, "Nama Vendor / Perusahaan", 3);
    if (!nameCheck.valid) errors.name = nameCheck.message;

    if (phone.trim()) {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.valid) errors.phone = phoneCheck.message;
    }

    if (email.trim()) {
      const emailCheck = validateEmail(email, false);
      if (!emailCheck.valid) errors.email = emailCheck.message;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const created = await postJson<{ id: string }>(
        "/api/procurement/suppliers",
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          type,
          contactPerson: contact.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
        },
        "Gagal mendaftarkan supplier."
      );
      await onCreated(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mendaftarkan supplier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#050505]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-3.5 text-xs">
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          <FormSummaryAlert errors={attempted ? fieldErrors : {}} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#050505] mb-1">
                Kode Supplier <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder={codePlaceholder}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, code: undefined }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] uppercase font-mono focus:outline-hidden transition-colors ${
                  attempted && fieldErrors.code
                    ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                    : "border-[#CED0D4] focus:border-[#1877F2]"
                }`}
              />
              <FormFieldFeedback error={attempted ? fieldErrors.code : undefined} />
            </div>
            <div>
              <label className="block font-semibold text-[#050505] mb-1">Kategori Vendor *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "book" | "uniform" | "all")}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              >
                <option value="uniform">Konveksi / Seragam</option>
                <option value="book">Penerbit / Buku</option>
                <option value="all">Keduanya (Universal)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#050505] mb-1">
              Nama Perusahaan / Vendor <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              placeholder={namePlaceholder}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (attempted) setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] focus:outline-hidden transition-colors ${
                attempted && fieldErrors.name
                  ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                  : "border-[#CED0D4] focus:border-[#1877F2]"
              }`}
            />
            <FormFieldFeedback error={attempted ? fieldErrors.name : undefined} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-[#050505] mb-1">Kontak Person</label>
              <input
                type="text"
                placeholder="Bpk/Ibu PIC"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#050505] mb-1">No. Telepon / WA</label>
              <input
                type="text"
                placeholder="0812xxxx"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] focus:outline-hidden transition-colors ${
                  attempted && fieldErrors.phone
                    ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                    : "border-[#CED0D4] focus:border-[#1877F2]"
                }`}
              />
              <FormFieldFeedback error={attempted ? fieldErrors.phone : undefined} />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#050505] mb-1">Email</label>
            <input
              type="email"
              placeholder="sales@supplier.co.id"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (attempted) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] focus:outline-hidden transition-colors ${
                attempted && fieldErrors.email
                  ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                  : "border-[#CED0D4] focus:border-[#1877F2]"
              }`}
            />
            <FormFieldFeedback error={attempted ? fieldErrors.email : undefined} />
          </div>

          <div>
            <label className="block font-semibold text-[#050505] mb-1">Alamat Kantor / Gudang</label>
            <textarea
              rows={2}
              placeholder="Alamat lengkap supplier..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Menyimpan..." : "Daftarkan Supplier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
