/**
 * Satu-satunya pemilik niat buat-buku-bersama-cover: Book dibuat dulu,
 * lalu cover diupload; bila cover gagal, Book yatim dihapus (kompensasi
 * ala orphan-delete intake publik) agar kegagalan tak bersembunyi di
 * pemanggil. Murni dan diuji lewat adapter fetch injeksian — bukan JSX.
 */

export interface NewBookPayload {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishYear: number;
  category: string;
  price: number;
  buyPrice: number;
  sellPrice: number;
}

export interface CatalogFetchAdapter {
  createBook: (payload: NewBookPayload) => Promise<{ id: string }>;
  uploadCover: (bookId: string, form: FormData) => Promise<unknown>;
  deleteBook: (bookId: string) => Promise<unknown>;
}

export type CatalogIntentCode = "cover-failed-rolled-back" | "cover-failed-compensation-failed";

export class CatalogIntentError extends Error {
  code: CatalogIntentCode;
  constructor(code: CatalogIntentCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const buildCoverForm = (file: File): FormData => {
  const form = new FormData();
  form.append("cover", file);
  return form;
};

export const createBookWithCover = async (
  adapter: CatalogFetchAdapter,
  payload: NewBookPayload,
  coverFile: File | null
): Promise<{ id: string; coverUploaded: boolean }> => {
  const created = await adapter.createBook(payload);
  if (!coverFile) return { id: created.id, coverUploaded: false };

  try {
    await adapter.uploadCover(created.id, buildCoverForm(coverFile));
    return { id: created.id, coverUploaded: true };
  } catch (coverErr) {
    const coverMessage = coverErr instanceof Error ? coverErr.message : "Upload cover gagal";
    try {
      await adapter.deleteBook(created.id);
    } catch (deleteErr) {
      const deleteMessage = deleteErr instanceof Error ? deleteErr.message : "Hapus buku yatim gagal";
      throw new CatalogIntentError(
        "cover-failed-compensation-failed",
        `Buku tersimpan tetapi upload cover gagal (${coverMessage}); pembersihan otomatis pun gagal (${deleteMessage}). Buku "${created.id}" perlu dihapus manual.`
      );
    }
    throw new CatalogIntentError(
      "cover-failed-rolled-back",
      `Buku tersimpan tetapi upload cover gagal (${coverMessage}); pembuatan buku dibatalkan agar tidak yatim. Silakan ulangi.`
    );
  }
};
