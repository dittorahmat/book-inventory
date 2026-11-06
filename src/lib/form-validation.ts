/**
 * Shared client-side form validation helpers
 * Enforces explicit field messages, digit constraints, and feedback loops.
 */

export interface ValidationRuleResult {
  valid: boolean;
  message?: string;
}

/**
 * Validasi nomor HP / WhatsApp:
 * Harus berupa angka (opsional awalan +), minimal 10 digit, maksimal 15 digit.
 */
export function validatePhone(phone: string): ValidationRuleResult {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { valid: false, message: "Nomor WhatsApp / HP wajib diisi." };
  }
  // buang tanda plus dan spasi/dash untuk pengecekan digit
  const digitsOnly = trimmed.replace(/[\s+-]/g, "");
  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, message: "Nomor HP hanya boleh berisi angka (contoh: 08123456789)." };
  }
  if (digitsOnly.length < 10) {
    return {
      valid: false,
      message: `Nomor HP terlalu pendek (${digitsOnly.length} digit). Minimal 10 digit angka.`,
    };
  }
  if (digitsOnly.length > 15) {
    return {
      valid: false,
      message: `Nomor HP terlalu panjang (${digitsOnly.length} digit). Maksimal 15 digit angka.`,
    };
  }
  return { valid: true };
}

/**
 * Validasi NIS (Nomor Induk Siswa):
 * Minimal 3 karakter, alfanumerik.
 */
export function validateNis(nis: string): ValidationRuleResult {
  const trimmed = nis.trim();
  if (!trimmed) {
    return { valid: false, message: "NIS wajib diisi." };
  }
  if (trimmed.length < 3) {
    return {
      valid: false,
      message: `NIS terlalu pendek (${trimmed.length} karakter). Minimal 3 karakter.`,
    };
  }
  if (trimmed.length > 30) {
    return {
      valid: false,
      message: `NIS terlalu panjang (${trimmed.length} karakter). Maksimal 30 karakter.`,
    };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return {
      valid: false,
      message: "NIS hanya boleh berisi huruf, angka, dan tanda hubung (-).",
    };
  }
  return { valid: true };
}

/**
 * Validasi teks wajib (nama, dsb.) dengan batas minimal karakter.
 */
export function validateRequiredText(value: string, fieldName: string, minLength = 2): ValidationRuleResult {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return { valid: false, message: `${fieldName} wajib diisi.` };
  }
  if (trimmed.length < minLength) {
    return {
      valid: false,
      message: `${fieldName} minimal ${minLength} karakter.`,
    };
  }
  return { valid: true };
}

/**
 * Validasi pilihan dropdown / select wajib (tidak boleh kosong / placeholder).
 */
export function validateRequiredSelect(value: string | undefined | null, fieldName: string): ValidationRuleResult {
  if (!value || !value.trim()) {
    return { valid: false, message: `Silakan pilih ${fieldName} terlebih dahulu.` };
  }
  return { valid: true };
}

/**
 * Validasi email sederhana.
 */
export function validateEmail(email: string, required = true): ValidationRuleResult {
  const trimmed = (email || "").trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, message: "Alamat email wajib diisi." };
    }
    return { valid: true };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: "Format email tidak valid (contoh: nama@domain.com)." };
  }
  return { valid: true };
}

/**
 * Validasi berkas bukti (file base64).
 */
export function validateProofFile(fileData: string | undefined | null, fileLabel: string): ValidationRuleResult {
  if (!fileData || !fileData.trim()) {
    return { valid: false, message: `${fileLabel} wajib diunggah.` };
  }
  return { valid: true };
}
