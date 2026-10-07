import { useState } from "react";
import { Building2, X } from "lucide-react";

interface CreateSupplierModalProps {
  onClose: () => void;
  onCreated: (newSupplierId: string) => void | Promise<void>;
}

/** Modal pendaftaran supplier baru. */
export function CreateSupplierModal({ onClose, onCreated }: CreateSupplierModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert("Kode dan Nama Supplier wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          contactPerson: contact.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mendaftarkan supplier.");
      }
      await onCreated(data.data.id);
    } catch (err: any) {
      alert(err.message);
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
            <h3 className="text-sm font-bold text-[#050505]">Tambah Vendor / Supplier Baru</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-[#050505] mb-1">Kode Supplier *</label>
            <input
              type="text"
              placeholder="Contoh: SUP-ERL, MENTARI-ID"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] uppercase font-mono focus:outline-hidden focus:border-[#1877F2]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#050505] mb-1">Nama Perusahaan / Penerbit *</label>
            <input
              type="text"
              placeholder="Contoh: Penerbit Erlangga Pusat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
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
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#050505] mb-1">Email</label>
            <input
              type="email"
              placeholder="sales@supplier.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
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
