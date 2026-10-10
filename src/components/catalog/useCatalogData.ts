import { useCallback, useEffect, useState } from "react";
import type { Book } from "../../types";
import { delJson, getJson, postForm, postJson } from "../../lib/api";
import { createBookWithCover, buildCoverForm, type NewBookPayload } from "./catalog-intent";

/** Data katalog: daftar + buat-bersama-cover + upload/hapus, satu seam uji. */
export function useCatalogData() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setBooks(await getJson<Book[]>("/api/books", "Gagal memuat katalog buku."));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat katalog buku.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const createBook = useCallback(
    async (payload: NewBookPayload, coverFile: File | null) => {
      const out = await createBookWithCover(
        {
          createBook: (body) => postJson<{ id: string }>("/api/books", body, "Gagal mendaftarkan buku."),
          uploadCover: (bookId, form) => postForm(`/api/books/${bookId}/cover`, form, "Buku tersimpan, tetapi upload cover gagal"),
          deleteBook: (bookId) => delJson(`/api/books/${bookId}`, "Gagal membersihkan buku yatim."),
        },
        payload,
        coverFile
      );
      await loadCatalog();
      return out;
    },
    [loadCatalog]
  );

  const uploadCover = useCallback(
    async (bookId: string, file: File) => {
      await postForm(`/api/books/${bookId}/cover`, buildCoverForm(file), "Gagal mengunggah cover buku");
      await loadCatalog();
    },
    [loadCatalog]
  );

  const removeBook = useCallback(
    async (bookId: string) => {
      await delJson(`/api/books/${bookId}`, "Gagal menghapus buku.");
      await loadCatalog();
    },
    [loadCatalog]
  );

  return { books, isLoading, loadError, loadCatalog, createBook, uploadCover, removeBook };
}
