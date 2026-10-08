import { useCallback, useEffect, useState } from "react";
import type { Book, School } from "../../types";
import { buildQuery, getJson, postJson } from "../../lib/api";
import type { StockPotential } from "../../types/stock-summary";

export interface PackageRow {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  price: number;
  description?: string;
  totalItemsCount: number;
  items: Array<{
    id: string;
    bookId: string;
    title: string;
    isbn: string;
    author: string;
    category?: string;
    quantity: number;
  }>;
}

export interface NewPackagePayload {
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  price: number;
  description?: string;
  items: Array<{ bookId: string; quantity: number }>;
}

/** Data paket: daftar, katalog, dan potensi stok batch (1 request, bukan N+1 per paket). */
export function usePackagesData(activeSchool: School | null) {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, StockPotential>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPackagesData = useCallback(async () => {
    if (!activeSchool) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [pkgs, books] = await Promise.all([
        getJson<PackageRow[]>("/api/packages", "Gagal memuat daftar paket."),
        getJson<Book[]>("/api/books", "Gagal memuat katalog buku."),
      ]);
      setCatalogBooks(books);
      setPackages(pkgs);
      setStockMap(
        await getJson<Record<string, StockPotential>>(
          buildQuery("/api/packages/stock", { schoolId: activeSchool.id }),
          "Gagal memuat potensi stok paket."
        )
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data paket.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSchool]);

  useEffect(() => {
    loadPackagesData();
  }, [loadPackagesData]);

  const createPackage = useCallback(
    async (payload: NewPackagePayload) => {
      await postJson("/api/packages", payload, "Gagal membuat paket baru.");
      await loadPackagesData();
    },
    [loadPackagesData]
  );

  return { packages, catalogBooks, stockMap, isLoading, loadError, loadPackagesData, createPackage };
}
