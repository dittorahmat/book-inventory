import { useState, useEffect, useCallback } from "react";
import {
  fetchStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  verifyStudent,
} from "./students-api";
import type { StudentRecord, StudentFormPayload } from "./students-api";

export type StudentStatusFilter = "all" | "active" | "promoted" | "new_pending" | "rejected" | "graduated";

export function useStudents(schoolId: string | null) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [knownRombels, setKnownRombels] = useState<string[]>([]);
  const [pendingList, setPendingList] = useState<StudentRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("all");
  const [rombelFilter, setRombelFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, pending] = await Promise.all([
        fetchStudents({
          schoolId: schoolId || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          rombel: rombelFilter === "all" ? undefined : rombelFilter,
          search: search.trim() || undefined,
        }),
        fetchStudents({ schoolId: schoolId || undefined, status: "new_pending" }),
      ]);
      setStudents(list);
      // Simpan daftar rombel unik kumulatif agar dropdown opsi tidak menciut saat salah satu rombel dipilih
      const currentRombels = list.map((st) => st.rombel).filter((r): r is string => Boolean(r));
      if (currentRombels.length > 0) {
        setKnownRombels((prev) => Array.from(new Set([...prev, ...currentRombels])).sort());
      }
      setPendingList(pending);
      setPendingCount(pending.length);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data siswa.");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, statusFilter, rombelFilter, search]);

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
    isLoading, isSaving, verifyingId, error, setError,
    showForm, setShowForm, editing, openCreate, openEdit,
    load, save, remove, verify,
  };
}
