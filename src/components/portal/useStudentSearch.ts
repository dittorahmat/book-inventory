import { useState, useEffect } from "react";
import type { SchoolOption, StudentSearchResult, NewStudentForm } from "../../lib/portal-types";
import { searchStudents, registerStudent } from "./portal-api";

export const PORTAL_STUDENT_SEARCH_INPUT_ID = "portal-student-search-input";

export const getPendingNoResultQuery = (
  searchQuery: string,
  resultsLength: number
): string | null => {
  const trimmed = searchQuery.trim();
  if (trimmed.length < 2 || resultsLength > 0) return null;
  return trimmed;
};

export const EMPTY_NEW_STUDENT: NewStudentForm = {
  schoolId: "",
  name: "",
  gender: "male",
  gradeLevel: "1",
  curriculumType: "international",
  academicYear: "2026/2027",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
};

export interface UseStudentSearchOptions<T extends StudentSearchResult = StudentSearchResult> {
  schools: SchoolOption[];
  onSelectStudent: (st: T) => void;
  onError: (msg: string | null) => void;
  searchFn?: (params: { query: string; schoolId: string }) => Promise<T[]>;
}

export function useStudentSearch<T extends StudentSearchResult = StudentSearchResult>({
  schools,
  onSelectStudent,
  onError,
  searchFn = searchStudents as unknown as (params: { query: string; schoolId: string }) => Promise<T[]>,
}: UseStudentSearchOptions<T>) {
  const [searchSchoolId, setSearchSchoolId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<T[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<T | null>(null);
  const [isNewStudentMode, setIsNewStudentMode] = useState(false);
  const [pendingNoResult, setPendingNoResult] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState<NewStudentForm>(EMPTY_NEW_STUDENT);
  const [isRegistering, setIsRegistering] = useState(false);
  const [verificationPending, setVerificationPending] = useState<{ name: string } | null>(null);

  useEffect(() => {
    if (schools.length > 0) {
      setNewStudent((prev) => (prev.schoolId ? prev : { ...prev, schoolId: schools[0].id }));
      setSearchSchoolId((prev) => prev || schools[0].id);
    }
  }, [schools]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchSchoolId) {
      onError("Pilih sekolah terlebih dahulu.");
      return;
    }
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      onError("Ketik NIS atau Nama siswa terlebih dahulu.");
      return;
    }
    setIsSearching(true);
    onError(null);
    setSearchResults([]);
    setPendingNoResult(null);

    try {
      const data = await searchFn({ query: trimmed, schoolId: searchSchoolId });
      setSearchResults(data);
      setPendingNoResult(getPendingNoResultQuery(trimmed, data.length));
    } catch (err: unknown) {
      const error = err as { message?: string };
      onError(error.message || "Gagal mencari siswa");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStudent = (st: T) => {
    setSelectedStudent(st);
    onSelectStudent(st);
  };

  const confirmNoResult = () => {
    if (!pendingNoResult) return;
    setNewStudent((prev) => ({
      ...prev,
      schoolId: searchSchoolId || prev.schoolId,
      name: pendingNoResult,
    }));
    setPendingNoResult(null);
    setIsNewStudentMode(true);
  };

  const cancelNoResult = () => setPendingNoResult(null);

  const handleRegisterNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.schoolId) {
      onError("Pilih sekolah/unit terlebih dahulu sebelum mendaftar.");
      return;
    }
    setIsRegistering(true);
    onError(null);
    try {
      const created = await registerStudent(newStudent);
      setVerificationPending({ name: created.name });
      setIsNewStudentMode(false);
    } catch (err: unknown) {
      const error = err as { message?: string };
      onError(error.message || "Terjadi kesalahan pendaftaran");
    } finally {
      setIsRegistering(false);
    }
  };

  return {
    searchSchoolId,
    setSearchSchoolId,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    selectedStudent,
    setSelectedStudent,
    isNewStudentMode,
    setIsNewStudentMode,
    pendingNoResult,
    newStudent,
    setNewStudent,
    isRegistering,
    verificationPending,
    setVerificationPending,
    handleSearch,
    handleSelectStudent,
    confirmNoResult,
    cancelNoResult,
    handleRegisterNewStudent,
  };
}
