import { useState } from "react";
import type { PackageRow } from "./usePackagesData";

/** Filter daftar paket (cari + kurikulum), cerminan CatalogToolbar. Murni UI-state. */
export function usePackagesFilter(packages: PackageRow[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("all");

  const q = searchQuery.toLowerCase();
  const filteredPackages = packages.filter(
    (pkg) =>
      (pkg.name.toLowerCase().includes(q) ||
        pkg.code.toLowerCase().includes(q) ||
        pkg.items.some((i) => i.title.toLowerCase().includes(q))) &&
      (selectedCurriculum === "all" || pkg.curriculumType === selectedCurriculum)
  );

  return { searchQuery, setSearchQuery, selectedCurriculum, setSelectedCurriculum, filteredPackages };
}
