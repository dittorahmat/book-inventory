import { describe, expect, it } from "bun:test";
import {
  validateEmail,
  validateNis,
  validatePhone,
  validateProofFile,
  validateRequiredSelect,
  validateRequiredText,
} from "./form-validation";

describe("form-validation helpers", () => {
  describe("validatePhone", () => {
    it("rejects empty phone", () => {
      const res = validatePhone("");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("wajib diisi");
    });

    it("rejects non-numeric characters", () => {
      const res = validatePhone("0812abcd3456");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("hanya boleh berisi angka");
    });

    it("rejects phone shorter than 10 digits", () => {
      const res = validatePhone("0812345");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("terlalu pendek");
      expect(res.message).toContain("Minimal 10 digit");
    });

    it("rejects phone longer than 15 digits", () => {
      const res = validatePhone("081234567890123456");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("terlalu panjang");
      expect(res.message).toContain("Maksimal 15 digit");
    });

    it("accepts valid phone with + prefix and dashes", () => {
      const res = validatePhone("+62 812-3456-7890");
      expect(res.valid).toBe(true);
      expect(res.message).toBeUndefined();
    });
  });

  describe("validateNis", () => {
    it("rejects empty NIS", () => {
      const res = validateNis("   ");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("wajib diisi");
    });

    it("rejects NIS shorter than 3 characters", () => {
      const res = validateNis("12");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("Minimal 3 karakter");
    });

    it("accepts valid NIS", () => {
      const res = validateNis("NIS-2026-001");
      expect(res.valid).toBe(true);
    });
  });

  describe("validateRequiredText", () => {
    it("rejects text below min length", () => {
      const res = validateRequiredText("A", "Nama Siswa", 2);
      expect(res.valid).toBe(false);
      expect(res.message).toBe("Nama Siswa minimal 2 karakter.");
    });

    it("accepts valid text", () => {
      const res = validateRequiredText("Muhammad Ali", "Nama Siswa");
      expect(res.valid).toBe(true);
    });
  });

  describe("validateRequiredSelect", () => {
    it("rejects empty select", () => {
      const res = validateRequiredSelect("", "Sekolah");
      expect(res.valid).toBe(false);
      expect(res.message).toBe("Silakan pilih Sekolah terlebih dahulu.");
    });

    it("accepts selected value", () => {
      const res = validateRequiredSelect("sch-01", "Sekolah");
      expect(res.valid).toBe(true);
    });
  });

  describe("validateEmail", () => {
    it("rejects invalid format", () => {
      const res = validateEmail("invalid-email");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("Format email tidak valid");
    });

    it("accepts valid email", () => {
      const res = validateEmail("ortu@alwildan.sch.id");
      expect(res.valid).toBe(true);
    });
  });

  describe("validateProofFile", () => {
    it("rejects empty proof file", () => {
      const res = validateProofFile("", "Bukti transfer");
      expect(res.valid).toBe(false);
      expect(res.message).toBe("Bukti transfer wajib diunggah.");
    });

    it("accepts valid proof file", () => {
      const res = validateProofFile("data:image/jpeg;base64,abc123", "Bukti transfer");
      expect(res.valid).toBe(true);
    });
  });
});
