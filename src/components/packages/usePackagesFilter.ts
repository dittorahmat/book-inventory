import { useMemo, useState } from "react";
import type { PackageRow } from "./usePackagesData";
import { useDebouncedSearch } from "../../lib/useDebouncedSearch";

/** Filter daftar paket (cari + kurikulum), cerminan CatalogToolbar. Murni UI-state. */
export function usePackagesFilter(packages: PackageRow[]) {
  const { searchQuery, setSearchQuery, debouncedSearch } = useDebouncedSearch("");
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("all");

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
