import { useCallback, useEffect, useState } from "react";
import type { School, User } from "../../types";
import { getJson, postJson } from "../../lib/api";

export interface NewSchoolInput {
  name: string;
  code: string;
  type: "main" | "branch" | "warehouse";
  address: string;
  phone: string;
}

export interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin";
  schoolId?: string;
}

/** Data organisasi: daftar sekolah + staf, beserta aksi tambah via seam fetch kanonik. */
export function useSettingsData() {
  const [schoolsList, setSchoolsList] = useState<School[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [schools, users] = await Promise.all([
        getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah."),
        getJson<User[]>("/api/users", "Gagal memuat daftar staf."),
      ]);
      setSchoolsList(schools);
      setUsersList(users);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data pengaturan.");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createSchool = useCallback(
    async (input: NewSchoolInput) => {
      await postJson("/api/schools", input, "Gagal menambah sekolah.");
      await fetchData();
    },
    [fetchData]
  );

  const createUser = useCallback(
    async (input: NewUserInput) => {
      await postJson("/api/users", { ...input, schoolId: input.schoolId || null }, "Gagal menambah staf.");
      await fetchData();
    },
    [fetchData]
  );

  return { schoolsList, usersList, loadError, fetchData, createSchool, createUser };
}
