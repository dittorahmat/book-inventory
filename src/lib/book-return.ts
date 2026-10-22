/**
 * Aturan bersama alur refund buku publik (klien + server). Angka batas foto
 * hanya boleh hidup di sini: server memvalidasi jumlah karakter base64,
 * klien memvalidasi ukuran berkas — keduanya diturunkan dari satu byte limit.
 */
export const BOOK_RETURN_MIN_QUERY = 3;
export const BOOK_RETURN_MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** Base64 ≈ 4/3 ukuran biner, plus prefix `data:image/…;base64,`. */
export const BOOK_RETURN_MAX_PHOTO_BASE64_CHARS =
  Math.ceil((BOOK_RETURN_MAX_PHOTO_BYTES * 4) / 3) + 128;

export const BOOK_RETURN_PHOTO_DATA_URL = /^data:image\/(jpeg|png|webp);base64,/;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Deteksi tipe gambar dari magic bytes; `null` = bukan gambar yang didukung. */
export const detectImageMime = (bytes: Uint8Array): ImageMime | null => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return riff && webp ? "image/webp" : null;
};

export interface BookReturnStatusView {
  text: string;
  cls: string;
  returnable: boolean;
  blockedReason: string | null;
}

/**
 * Satu-satunya pemilik aturan status refund di portal. Sengaja lebih ketat dari
 * `ORDER_REPORTABLE_STATUSES` di sisi server: sumber publik hanya menerima
 * `picked_up`, sehingga satu pesanan tidak bisa mengirim pengajuan ganda
 * (`return_in_progress` sudah punya pengajuan aktif).
 */
export const bookReturnStatus = (status: string): BookReturnStatusView => {
  if (status === "picked_up") {
    return {
      text: "Sudah diserahkan",
      cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
      returnable: true,
      blockedReason: null,
    };
  }
  if (status === "return_in_progress") {
    return {
      text: "Refund sedang diproses",
      cls: "text-[#1877F2] bg-[#E7F3FF] border-[#C3DFFF]",
      returnable: false,
      blockedReason: "Pengajuan refund untuk pesanan ini sudah dikirim dan sedang diperiksa logistik.",
    };
  }
  return {
    text: "Belum diserahkan",
    cls: "text-amber-700 bg-amber-50 border-amber-200",
    returnable: false,
    blockedReason: "Buku belum diserahkan ke siswa, jadi belum bisa diajukan refund.",
  };
};
