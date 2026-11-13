import { useState, useEffect, useCallback } from "react";
import {
  fetchStudents,
  fetchSchoolRombels,
  createStudent,
  updateStudent,
  deleteStudent,
  verifyStudent,
} from "./students-api";
import type { StudentRecord, StudentFormPayload, StudentPaginationMeta } from "./students-api";

export type StudentStatusFilter = "all" | "active" | "promoted" | "new_pending" | "rejected" | "graduated";

export function useStudents(schoolId: string | null) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [knownRombels, setKnownRombels] = useState<string[]>([]);
  const [pendingList, setPendingList] = useState<StudentRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("all");
  const [rombelFilter, setRombelFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<StudentPaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | null>(null);

  // Muat opsi rombel data-driven dari server saat sekolah berubah
  useEffect(() => {
    let active = true;
    fetchSchoolRombels(schoolId || undefined)
      .then((rombels) => {
        if (active) {
          setKnownRombels(rombels);
        }
      })
      .catch(() => {
        // Abaikan error rombel, fallback ke rombel dari daftar siswa
      });
    return () => {
      active = false;
    };
  }, [schoolId]);

  // Reset page ke 1 setiap kali filter berubah
  useEffect(() => {
    setPage(1);
  }, [schoolId, statusFilter, rombelFilter, search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listRes, pendingRes] = await Promise.all([
        fetchStudents({
          schoolId: schoolId || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          rombel: rombelFilter === "all" ? undefined : rombelFilter,
          search: search.trim() || undefined,
          page,
          limit: 50,
        }),
        fetchStudents({ schoolId: schoolId || undefined, status: "new_pending", limit: 100 }),
      ]);
      setStudents(listRes.students);
      if (listRes.pagination) {
        setPagination(listRes.pagination);
      } else {
        setPagination({
          page: 1,
          limit: 50,
          total: listRes.students.length,
          totalPages: 1,
        });
      }
      // Kumulatifkan rombel jika server rombel kosong
      const currentRombels = listRes.students.map((st) => st.rombel).filter((r): r is string => Boolean(r));
      if (currentRombels.length > 0) {
        setKnownRombels((prev) => Array.from(new Set([...prev, ...currentRombels])).sort());
      }
      setPendingList(pendingRes.students);
      setPendingCount(pendingRes.students.length);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data siswa.");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, statusFilter, rombelFilter, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (st: StudentRecord) => {
    setEditing(st);
    setShowForm(true);
  };

  const save = async (payload: StudentFormPayload) => {
    setIsSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateStudent(editing.id, payload);
      } else {
        await createStudent(payload);
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data siswa.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteStudent(id);
      await load();
    } catch (err: any) {
      setError(err.message || "Gagal menghapus data siswa.");
    }
  };

  const verify = async (id: string, action: "approve" | "reject", nis?: string) => {
    setVerifyingId(id);
    setError(null);
    try {
      await verifyStudent(id, action, nis);
      await load();
    } catch (err: any) {
      setError(err.message || "Gagal memverifikasi siswa.");
    } finally {
      setVerifyingId(null);
    }
  };

  return {
    students, knownRombels, pendingList, pendingCount, search, setSearch, statusFilter, setStatusFilter,
    rombelFilter, setRombelFilter,
    page, setPage, pagination,
    isLoading, isSaving, verifyingId, error, setError,
    showForm, setShowForm, editing, openCreate, openEdit,
    load, save, remove, verify,
  };
}
