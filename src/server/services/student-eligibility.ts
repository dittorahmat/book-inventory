/**
 * Satu-satunya aturan "bolehkah murid ini memesan?" untuk intake buku dan
 * seragam. Identitas wali tidak memakai akun (ADR-0014), jadi status
 * `new_pending`/`rejected` wajib diblokir sampai admin sekolah memverifikasi;
 * status lain yang bukan aktif/promosi juga ditolak agar salinan portal dan
 * penegakan submit tidak pernah berbeda.
 *
 * Pemanggil hanya memetakan alasan ke kode HTTP/pesan tampilan; aturan
 * kelayakannya sendiri tidak boleh disalin.
 */

export type StudentEligibilityReason = "not_found" | "not_allowed";

export type StudentEligibility =
  | { ok: true }
  | { ok: false; reason: StudentEligibilityReason; message: string };

export const ORDER_ALLOWED_STATUSES = ["active", "promoted"] as const;

export const evaluateStudentEligibility = (
  student: { status: string } | undefined
): StudentEligibility => {
  if (!student) return { ok: false, reason: "not_found", message: "Data murid tidak ditemukan" };
  return (ORDER_ALLOWED_STATUSES as readonly string[]).includes(student.status)
    ? { ok: true }
    : {
        ok: false,
        reason: "not_allowed",
        message: "Data siswa masih menunggu verifikasi admin sekolah. Silakan coba lagi setelah disetujui.",
      };
};

/** Kode HTTP kanonik: murid tidak ada = 404, tidak berhak memesan = 403. */
export const eligibilityStatus = (reason: StudentEligibilityReason): 403 | 404 =>
  reason === "not_found" ? 404 : 403;
