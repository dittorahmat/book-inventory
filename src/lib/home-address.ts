/** Validasi alamat kirim-rumah fleksibel: teks bebas tetapi wajib memuat RT, RW, dan kode pos. */
export interface HomeAddressCheck {
  ok: boolean;
  message?: string;
}

const hasRt = (v: string): boolean => /(^|\W)rt\.?\s*\d/i.test(v);
const hasRw = (v: string): boolean => /(^|\W)rw\.?\s*\d/i.test(v);
const hasPostal = (v: string): boolean => /\b\d{5}\b/.test(v);

export const validateHomeAddress = (address: unknown): HomeAddressCheck => {
  if (typeof address !== "string" || !address.trim()) return { ok: false, message: "Alamat rumah wajib diisi." };
  const v = address.trim();
  if (v.length < 20) return { ok: false, message: "Alamat rumah wajib diisi lengkap (min. 20 karakter)." };
  if (!hasRt(v)) return { ok: false, message: "Alamat wajib memuat RT (contoh: RT 03)." };
  if (!hasRw(v)) return { ok: false, message: "Alamat wajib memuat RW (contoh: RW 05)." };
  if (!hasPostal(v)) return { ok: false, message: "Alamat wajib memuat kode pos 5 digit." };
  return { ok: true };
};
