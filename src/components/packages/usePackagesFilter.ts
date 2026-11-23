import { useState, useEffect, useMemo } from "react";
import type { PackageRow } from "./usePackagesData";

/** Filter daftar paket (cari + kurikulum), cerminan CatalogToolbar. Murni UI-state. */
export function usePackagesFilter(packages: PackageRow[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("all");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const filteredPackages = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return packages.filter(
      (pkg) =>
        (!q ||
          pkg.name.toLowerCase().includes(q) ||
          pkg.code.toLowerCase().includes(q) ||
          pkg.items.some((i) => i.title.toLowerCase().includes(q))) &&
        (selectedCurriculum === "all" || pkg.curriculumType === selectedCurriculum)
    );
  }, [packages, debouncedSearch, selectedCurriculum]);

  return { searchQuery, setSearchQuery, selectedCurriculum, setSelectedCurriculum, filteredPackages, debouncedSearch };
}
