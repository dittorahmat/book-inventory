import { useEffect, useState } from "react";
import type { School } from "../types";
import { api } from "../lib/api";

/** Single source for school list: replaces 3x independent fetch("/api/schools"). */
export const useSchools = () => {
  const [schools, setSchools] = useState<School[]>([]);
  useEffect(() => {
    api<School[]>("/api/schools", undefined, "Gagal memuat daftar sekolah.")
      .then(setSchools)
      .catch(() => setSchools([]));
  }, []);
  return schools;
};
