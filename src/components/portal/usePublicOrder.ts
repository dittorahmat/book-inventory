import { useState, useEffect } from "react";
import { resolveLockedPackage } from "../../lib/resolve-package";
import {
  fetchSchools,
  fetchPackages,
  searchStudents,
  registerStudent,
  submitFinalOrder,
} from "./portal-api";
import type {
  SchoolOption,
  StudentSearchResult,
  BookPackageOption,
  NewStudentForm,
  FileUploadHandler,
} from "../../lib/portal-types";

export type OrderStep = 1 | 2 | 3 | 4;
export type PortalTab = "order" | "return";

const EMPTY_NEW_STUDENT: NewStudentForm = {
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

export function usePublicOrder() {
  const [activePortalTab, setActivePortalTab] = useState<PortalTab>("order");

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [packages, setPackages] = useState<BookPackageOption[]>([]);

  // Step wizard: 1 = Student Selection, 2 = Locked Package Detail,
  // 3 = Payment / Scholarship, 4 = Success
  const [step, setStep] = useState<OrderStep>(1);

  // Search state for student ordering
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [isNewStudentMode, setIsNewStudentMode] = useState(false);

  // New Student form
  const [newStudent, setNewStudent] = useState<NewStudentForm>(EMPTY_NEW_STUDENT);

  // Package & Order State
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [orderType, setOrderType] = useState<"regular" | "scholarship">("regular");
  const [scholarshipProofBase64, setScholarshipProofBase64] = useState<string>("");

  // Payment details (Regular)
  const [paymentChoice, setPaymentChoice] = useState<"full" | "partial">("full");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [bookAllocationAmount, setBookAllocationAmount] = useState<number>(0);
  const [bankName, setBankName] = useState("BCA");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentProofBase64, setPaymentProofBase64] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<any>(null);

  // Menunggu verifikasi admin: pendaftar baru terkunci total di sini
  const [verificationPending, setVerificationPending] = useState<{ name: string } | null>(null);

  // Pindah step selalu menghapus error lama agar banner tidak bocor antar step
  const goToStep = (next: OrderStep) => {
    setErrorMessage(null);
    setStep(next);
  };

  // Locked package resolution: single package matching
  // (targetGradeLevel, curriculumType), preferring latest academicYear.
  // Re-runs when the package list arrives after a student was selected.
  useEffect(() => {
    if (!selectedStudent || packages.length === 0 || step < 2) return;
    const matched = resolveLockedPackage(selectedStudent, packages);
    const nextId = matched ? matched.id : "";
    if (nextId === selectedPackageId) return;
    setSelectedPackageId(nextId);
    if (matched) {
      setTransferAmount(matched.price);
      setBookAllocationAmount(matched.price);
    }
  }, [packages, selectedStudent, step, selectedPackageId]);

  const applyLockedPackage = (st: StudentSearchResult) => {
    const matched = resolveLockedPackage(st, packages);
    if (matched) {
      setSelectedPackageId(matched.id);
      setTransferAmount(matched.price);
      setBookAllocationAmount(matched.price);
    } else {
      setSelectedPackageId("");
    }
  };

  // Load schools & packages on mount
  useEffect(() => {
    fetchSchools()
      .then((list) => {
        setSchools(list);
        if (list.length > 0) {
          setNewStudent((prev) => ({ ...prev, schoolId: list[0].id }));
        }
      })
      .catch((err: any) => {
        setErrorMessage(err.message || "Gagal memuat daftar sekolah. Periksa koneksi Anda.");
      });

    fetchPackages()
      .then((list) => setPackages(list))
      .catch((err: any) => {
        setErrorMessage(err.message || "Gagal memuat daftar paket buku. Periksa koneksi Anda.");
      });
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const results = await searchStudents(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setIsNewStudentMode(true);
        setNewStudent((prev) => ({ ...prev, name: searchQuery.trim() }));
      } else {
        setIsNewStudentMode(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal melakukan pencarian siswa. Silakan coba lagi.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStudent = (st: StudentSearchResult) => {
    setErrorMessage(null);
    setSelectedStudent(st);
    setIsNewStudentMode(false);

    // Lock the single matching package (no manual package choice)
    applyLockedPackage(st);
    setStep(2);
  };

  const handleRegisterNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await registerStudent(newStudent);

      // Kunci total: tidak langsung jadi selectedStudent, melainkan
      // layar tunggu sampai admin memverifikasi (status new_pending).
      setVerificationPending({ name: created.name });
      setIsNewStudentMode(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan pendaftaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload: FileUploadHandler = (e, setter) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const handleSubmitFinalOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedPackage) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (orderType === "scholarship" && !scholarshipProofBase64) {
        throw new Error("Dokumen bukti surat tanda beasiswa wajib dilampirkan.");
      }

      const data = await submitFinalOrder({
        studentId: selectedStudent.id,
        packageId: selectedPackage.id,
        orderType,
        notes: notes.trim() || undefined,
        ...(orderType === "scholarship"
          ? { scholarshipProofBase64 }
          : {}),
        ...(orderType === "regular" && bookAllocationAmount > 0
          ? {
              payment: {
                transferAmount: transferAmount || bookAllocationAmount,
                bookAllocationAmount,
                bankName,
                referenceNumber: referenceNumber || undefined,
                paymentProofBase64: paymentProofBase64 || undefined,
              },
            }
          : {}),
      });

      setSubmittedOrder(data);
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kendala saat mengirimkan pemesanan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetOrderFlow = () => {
    setStep(1);
    setErrorMessage(null);
    setSelectedStudent(null);
    setVerificationPending(null);
    setIsNewStudentMode(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  return {
    activePortalTab, setActivePortalTab,
    schools, packages, step, setStep, goToStep,
    searchQuery, setSearchQuery, isSearching, searchResults,
    selectedStudent, isNewStudentMode, setIsNewStudentMode,
    verificationPending, setVerificationPending,
    newStudent, setNewStudent,
    selectedPackageId, selectedPackage,
    orderType, setOrderType, scholarshipProofBase64, setScholarshipProofBase64,
    paymentChoice, setPaymentChoice, transferAmount, setTransferAmount,
    bookAllocationAmount, setBookAllocationAmount, bankName, setBankName,
    referenceNumber, setReferenceNumber, paymentProofBase64, setPaymentProofBase64,
    notes, setNotes,
    isSubmitting, errorMessage, setErrorMessage, submittedOrder,
    handleSearch, handleSelectStudent, handleRegisterNewStudent,
    handleFileUpload, handleSubmitFinalOrder,
    resetOrderFlow,
  };
}

export type PublicOrderState = ReturnType<typeof usePublicOrder>;
