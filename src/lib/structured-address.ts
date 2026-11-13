/**
 * Helper & Types untuk alamat pengiriman seragam terstruktur (AGENTS §GLOSSARY).
 * 8 field wajib:
 * 1. Nama Penerima
 * 2. No HP / WhatsApp
 * 3. Nama Jalan
 * 4. RT
 * 5. RW
 * 6. No Rumah
 * 7. Kelurahan
 * 8. Kecamatan
 * 9. Kota
 * (Opsional: Kode Pos)
 */

export interface StructuredAddressInput {
  recipientName: string;
  recipientPhone: string;
  street: string;
  rt: string;
  rw: string;
  houseNumber: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  postalCode?: string;
}

export function formatStructuredHomeAddress(input: StructuredAddressInput): string {
  const name = input.recipientName.trim();
  const phone = input.recipientPhone.trim();
  const street = input.street.trim();
  const houseNo = input.houseNumber.trim();
  const rt = input.rt.trim();
  const rw = input.rw.trim();
  const kel = input.kelurahan.trim();
  const kec = input.kecamatan.trim();
  const city = input.city.trim();
  const postal = (input.postalCode || "").trim();

  const recipientPart = `${name} (${phone})`;
  const addressPart = `${street} No. ${houseNo}, RT ${rt}/RW ${rw}, Kel. ${kel}, Kec. ${kec}, ${city}${
    postal ? ` ${postal}` : ""
  }`;

  return `${recipientPart} - ${addressPart}`;
}

export function validateStructuredAddress(input: StructuredAddressInput): {
  isValid: boolean;
  errors: Partial<Record<keyof StructuredAddressInput, string>>;
} {
  const errors: Partial<Record<keyof StructuredAddressInput, string>> = {};

  if (!input.recipientName?.trim()) errors.recipientName = "Nama penerima wajib diisi.";
  if (!input.recipientPhone?.trim()) {
    errors.recipientPhone = "Nomor HP/WA penerima wajib diisi.";
  } else if (!/^[0-9+ -]{8,18}$/.test(input.recipientPhone.trim())) {
    errors.recipientPhone = "Nomor HP/WA tidak valid (minimal 8 angka).";
  }

  if (!input.street?.trim()) errors.street = "Nama jalan wajib diisi.";
  if (!input.houseNumber?.trim()) errors.houseNumber = "Nomor rumah wajib diisi.";
  if (!input.rt?.trim()) errors.rt = "RT wajib diisi.";
  if (!input.rw?.trim()) errors.rw = "RW wajib diisi.";
  if (!input.kelurahan?.trim()) errors.kelurahan = "Kelurahan wajib diisi.";
  if (!input.kecamatan?.trim()) errors.kecamatan = "Kecamatan wajib diisi.";
  if (!input.city?.trim()) errors.city = "Kota/Kabupaten wajib diisi.";

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
