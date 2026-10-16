import { useCallback, useEffect, useState } from "react";
import { fetchPackages, fetchSatuanCatalog, fetchSchools } from "./portal-api";
import type { SatuanBookOption } from "./portal-api";
import type { BookPackageOption, SchoolOption } from "../../lib/portal-types";

/**
 * Katalog portal publik: sekolah, paket terkunci, dan katalog satuan.
 * Satu-satunya pemilik cache server alur order + retur — kedua hook
 * wizard membaca dari sini, bukan fetch sendiri-sendiri.
 */
export function usePortalCatalog() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [packages, setPackages] = useState<BookPackageOption[]>([]);
  const [satuanBooks, setSatuanBooks] = useState<SatuanBookOption[]>([]);
  const [satuanOpen, setSatuanOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Independen per sumber: satu gagal tidak boleh mengosongkan yang lain.
      const [schoolRes, packageRes, satuanRes] = await Promise.allSettled([
        fetchSchools(),
        fetchPackages(),
        // Gagal memuat status satuan tidak boleh memblokir pemesanan paket.
        fetchSatuanCatalog().catch(() => ({ open: false as const, status: undefined as never, books: [] })),
      ]);
      const schoolList = schoolRes.status === "fulfilled" ? schoolRes.value : ([] as SchoolOption[]);
      const packageList = packageRes.status === "fulfilled" ? packageRes.value : ([] as BookPackageOption[]);
      const satuan = satuanRes.status === "fulfilled" ? satuanRes.value : ({ open: false as const, books: [] });
      setSchools(schoolList);
      setPackages(packageList);
      setSatuanOpen(satuan.open);
      setSatuanBooks(satuan.books);
      const firstError =
        schoolRes.status === "rejected"
          ? schoolRes.reason
          : packageRes.status === "rejected"
            ? packageRes.reason
            : null;
      setLoadError(firstError instanceof Error ? firstError.message : firstError ? String(firstError) : null);
      return { schoolList };
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat katalog portal.");
      return { schoolList: [] as SchoolOption[] };
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { schools, packages, satuanBooks, satuanOpen, isLoading, loadError, reload };
}
