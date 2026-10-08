import { useState } from "react";
import { Building2, Plus, Pencil, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { patchJson, postJson } from "../../lib/api";

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface SupplierMasterSectionProps {
  suppliers: SupplierRecord[];
  onChanged: () => void;
}

type FormState = {
  id: string | null;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  code: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
};

const inputClass =
  "w-full px-2.5 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]";

/** Sub-bagian master supplier di tab PO: daftar, tambah, dan ubah. */
export function SupplierMasterSection({ suppliers, onChanged }: SupplierMasterSectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFeedback(null);
    setIsFormOpen(true);
  };

  const openEdit = (supplier: SupplierRecord) => {
    setForm({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
    });
    setFeedback(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setFeedback({ kind: "error", message: "Kode dan nama supplier wajib diisi." });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const isEdit = !!form.id;
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      };
      if (isEdit) {
        await patchJson(
          `/api/procurement/suppliers/${form.id}`,
          payload,
          "Gagal menyimpan data supplier."
        );
      } else {
        await postJson("/api/procurement/suppliers", payload, "Gagal menyimpan data supplier.");
      }
      setIsFormOpen(false);
      setForm(EMPTY_FORM);
      onChanged();
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : "Gagal menyimpan data supplier." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs">
      <header className="px-5 py-3.5 border-b border-[#E4E6EB] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-[#65676B] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#050505]">Master Supplier</h2>
            <p className="text-[11px] text-[#65676B]">Penerbit resmi pemasok buku untuk Purchase Order.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1.5 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors inline-flex items-center gap-1.5 active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 text-[#65676B]" />
          <span>Tambah Supplier</span>
        </button>
      </header>

      {feedback && !isFormOpen && (
        <div
          className={`mx-5 mt-3 flex items-start gap-1.5 text-xs ${
            feedback.kind === "ok" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{feedback.message}</span>
        </div>
      )}

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-[#E4E6EB] bg-[#F9FAFB] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Kode *</label>
              <input
                required
                className={inputClass}
                placeholder="SUP-ERL"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Supplier *</label>
              <input
                required
                className={inputClass}
                placeholder="Penerbit Erlangga"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Narahubung</label>
              <input
                className={inputClass}
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Email</label>
              <input
                type="email"
                className={inputClass}
                placeholder="sales@penerbit.co.id"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Telepon</label>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-[#050505] mb-1">Alamat</label>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>

          {feedback && (
            <div className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setForm(EMPTY_FORM);
                setFeedback(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#65676B] font-semibold text-xs transition-colors inline-flex items-center gap-1.5 active:scale-[0.98]"
            >
              <X className="w-3.5 h-3.5" />
              <span>Batal</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Menyimpan..." : form.id ? "Simpan Perubahan" : "Simpan Supplier"}</span>
            </button>
          </div>
        </form>
      )}

      {suppliers.length === 0 ? (
        <p className="px-5 py-6 text-xs text-[#65676B] text-center">
          Belum ada supplier. Klik <strong>Tambah Supplier</strong> untuk mendaftarkan penerbit pertama.
        </p>
      ) : (
        <ul className="divide-y divide-[#E4E6EB]">
          {suppliers.map((s) => (
            <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] font-bold text-[#1877F2]">{s.code}</span>
                  <span className="text-xs font-bold text-[#050505]">{s.name}</span>
                </div>
                <div className="text-[11px] text-[#65676B] mt-0.5 truncate">
                  {[s.contactPerson, s.email, s.phone].filter(Boolean).join(" · ") || "Kontak belum dilengkapi"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(s)}
                title="Ubah supplier"
                className="p-1.5 rounded-lg border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors shrink-0 active:scale-[0.98]"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
