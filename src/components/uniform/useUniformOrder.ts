import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { checkPendingOrders, type PendingOrderSummary } from "../portal/portal-api";
import { gradeToJenjang, type UniformCatalog, type UniformStudent } from "../../lib/uniform-types";
import type { SchoolOption } from "../../lib/portal-types";
import {
  fetchUniformSchools,
  searchUniformStudents,
  fetchUniformCatalog,
  fetchUniformSatuanStatus,
  submitUniformOrder,
} from "./uniform-portal-api";
import { validateHomeAddress } from "../../lib/home-address";
import { useStudentSearch } from "../portal/useStudentSearch";
import { findMatchingUniformSelection } from "../../lib/uniform-selection";
import { isKhimarSdVariant } from "../../lib/khimar-sd";

export type UniformStep = 1 | 2 | 3 | 4;

export function useUniformOrder() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [student, setStudent] = useState<UniformStudent | null>(null);
  const [catalog, setCatalog] = useState<UniformCatalog | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [packageQty, setPackageQty] = useState<Record<string, number>>({});
  const [satuanQty, setSatuanQty] = useState<Record<string, number>>({});
  const [sizeFor, setSizeFor] = useState<Record<string, string>>({});
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [orderType, setOrderType] = useState<"regular" | "scholarship">("regular");
  const [scholarshipProof, setScholarshipProof] = useState("");
  const [satuanOpen, setSatuanOpen] = useState(true);
  const [uniformMode, setUniformMode] = useState<"package" | "satuan">("package");
  const [step, setStep] = useState<UniformStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string; total: number } | null>(null);
  const [pendingUniformOrder, setPendingUniformOrder] = useState<PendingOrderSummary | null>(null);
  const [pendingStudentTarget, setPendingStudentTarget] = useState<UniformStudent | null>(null);
  const [replacePendingOrderId, setReplacePendingOrderId] = useState<string | null>(null);

  const search = useStudentSearch<UniformStudent>({
    schools,
    onSelectStudent: async (s) => {
      try {
        const pending = await checkPendingOrders(s.id);
        if (pending.uniformOrder) {
          setPendingStudentTarget(s);
          setPendingUniformOrder(pending.uniformOrder);
          return;
        }
      } catch {
        // Fallback
      }
      selectStudent(s);
    },
    onError: setError,
    searchFn: searchUniformStudents,
  });

  const {
    searchSchoolId: schoolId,
    setSearchSchoolId: setSchoolId,
    searchQuery: query,
    setSearchQuery: setQuery,
    isSearching: searching,
    searchResults: results,
    handleSearch,
  } = search;

  const searched = results.length > 0 || (!searching && query.trim().length >= 2);

  const jenjang = useMemo(() => (student ? gradeToJenjang(student.gradeLevel) : null), [student]);
  const gender = student?.gender ?? null;

  const visibleVariants = useMemo(
    () => catalog?.variants.filter((v) => v.jenjang === jenjang && (!gender || v.gender === gender)) ?? [],
    [catalog, jenjang, gender]
  );
  const visiblePackages = useMemo(() => {
    if (!catalog) return [];
    const variantById = new Map(catalog.variants.map((v) => [v.id, v]));
    return catalog.packages.filter((p) =>
      p.bom.every((b) => {
        const v = variantById.get(b.variantId);
        return v && v.jenjang === jenjang && (!gender || v.gender === gender);
      })
    );
  }, [catalog, jenjang, gender]);

  const priceByVariant = useMemo(() => new Map((catalog?.variants ?? []).map((v) => [v.id, v.price])), [catalog]);
  const priceByPackage = useMemo(() => new Map((catalog?.packages ?? []).map((p) => [p.id, p.price])), [catalog]);
  const total = useMemo(
    () =>
      Object.entries(packageQty).reduce((s, [id, q]) => s + (priceByPackage.get(id) ?? 0) * q, 0) +
      Object.entries(satuanQty).reduce((s, [key, q]) => s + (priceByVariant.get(key.split("::")[0]) ?? 0) * q, 0),
    [packageQty, satuanQty, priceByPackage, priceByVariant]
  );
  const itemCount = useMemo(
    () => Object.values(packageQty).reduce((s, q) => s + q, 0) + Object.values(satuanQty).reduce((s, q) => s + q, 0),
    [packageQty, satuanQty]
  );

  const bump = (setter: Dispatch<SetStateAction<Record<string, number>>>) => (key: string, delta: number) =>
    setter((prev: Record<string, number>) => {
      const next = (prev[key] ?? 0) + delta;
      const copy = { ...prev };
      if (next <= 0) delete copy[key];
      else copy[key] = Math.min(next, 50);
      return copy;
    });
  const bumpPackage = (id: string, delta: number) => bump(setPackageQty)(id, delta);
  const bumpSatuan = (key: string, delta: number) => bump(setSatuanQty)(key, delta);

  const loadSchools = async () => {
    try {
      setSchools(await fetchUniformSchools());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar sekolah.");
    }
  };

  const selectStudent = async (s: UniformStudent) => {
    // Kelayakan milik server (aturan yang sama dengan submit buku & seragam).
    if (s.canOrder === false) {
      setError(s.orderBlockedReason ?? "Data siswa masih menunggu verifikasi admin sekolah.");
      return;
    }
    setStudent(s);
    setLoadingCatalog(true);
    setError(null);
    try {
      const [catalogData, satuan] = await Promise.all([fetchUniformCatalog(s.academicYear), fetchUniformSatuanStatus()]);
      setCatalog(catalogData);
      setSatuanOpen(satuan.open);

      // Otomatis pilih paket bahan kain harian dan varian olahraga yang cocok
      const matched = findMatchingUniformSelection(s, catalogData);
      if (matched.package) {
        setPackageQty({ [matched.package.id]: 1 });
      }
      if (matched.olahraga) {
        // Otomatis siapkan 1 stel olahraga (namun menunggu ukuran dipilih di UI)
        setSatuanQty({ [matched.olahraga.id]: 1 });
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat katalog seragam.");
    } finally {
      setLoadingCatalog(false);
    }
  };

  const backToSearch = () => {
    setStudent(null);
    setCatalog(null);
    setPackageQty({});
    setSatuanQty({});
    setSizeFor({});
    setAddress("");
    setPostalCode("");
    setNotes("");
    setOrderType("regular");
    setScholarshipProof("");
    setUniformMode("package");
    setSuccess(null);
    setStep(1);
  };

  const isPostalCodeValid = /^\d{5}$/.test(postalCode.trim());
  const combinedAddress = postalCode.trim()
    ? `${address.trim()}, Kode Pos ${postalCode.trim()}`
    : address.trim();

  // Getter domain untuk seragam olahraga atau Khimar SD yang belum dipilih ukurannya
  const missingOlahragaVariants = useMemo(() => {
    return visibleVariants.filter((v) => {
      const isSized = v.kind === "olahraga" || isKhimarSdVariant(v);
      if (!isSized) return false;
      const picked = sizeFor[v.id] ?? "";
      const key = picked ? `${v.id}::${picked}` : v.id;
      const currentQty = satuanQty[key] ?? satuanQty[v.id] ?? 0;
      return currentQty > 0 && !picked;
    });
  }, [visibleVariants, sizeFor, satuanQty]);

  const missingPackageOlahraga = useMemo(() => {
    return visiblePackages.filter((p) => {
      const qty = packageQty[p.id] ?? 0;
      if (qty <= 0) return false;
      const needsSize = p.bom.some((b) => {
        const v = catalog?.variants.find((x) => x.id === b.variantId);
        return v?.kind === "olahraga" && b.size === "—";
      });
      return needsSize && !(sizeFor[p.id] ?? "");
    });
  }, [visiblePackages, packageQty, catalog, sizeFor]);

  const hasMissingOlahragaSize = missingOlahragaVariants.length > 0 || missingPackageOlahraga.length > 0;

  const canSubmit =
    itemCount > 0 &&
    isPostalCodeValid &&
    validateHomeAddress(combinedAddress).ok &&
    (orderType === "regular" || scholarshipProof !== "") &&
    !hasMissingOlahragaSize;

  const handleSubmit = async () => {
    if (!student || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const overrides: Record<string, string> = {};
      for (const [pkgId, size] of Object.entries(sizeFor)) {
        const pkg = catalog?.packages.find((p) => p.id === pkgId);
        pkg?.bom
          .filter((b) => {
            const v = catalog?.variants.find((x) => x.id === b.variantId);
            return v?.kind === "olahraga" && b.size === "—";
          })
          .forEach((b) => {
            overrides[b.variantId] = size;
          });
      }
      const items = [
        ...Object.entries(packageQty).map(([packageId, quantity]) => ({ packageId, quantity })),
        ...Object.entries(satuanQty).map(([key, quantity]) => {
          const [variantId, size] = key.split("::");
          return size ? { variantId, size, quantity } : { variantId, quantity };
        }),
      ];
      const res = await submitUniformOrder({
        studentId: student.id,
        academicYear: student.academicYear,
        homeAddress: combinedAddress,
        items,
        sizeOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        notes: notes.trim() || undefined,
        ...(replacePendingOrderId ? { replacePendingOrderId } : {}),
        ...(orderType === "scholarship" ? { orderType, scholarshipProofBase64: scholarshipProof } : {}),
      });
      setSuccess({ orderNumber: res.order.orderNumber, total: res.totalAmount });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses pesanan seragam.");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    schools, schoolId, setSchoolId, query, setQuery, searching, results, searched,
    student, catalog, loadingCatalog, visibleVariants, visiblePackages,
    packageQty, satuanQty, sizeFor, setSizeFor, bumpPackage, bumpSatuan,
    address, setAddress, postalCode, setPostalCode, isPostalCodeValid, notes, setNotes, step, setStep,
    orderType, setOrderType, scholarshipProof, setScholarshipProof, satuanOpen,
    uniformMode, setUniformMode,
    missingOlahragaVariants, missingPackageOlahraga, hasMissingOlahragaSize,
    submitting, error, setError, success, total, itemCount, canSubmit,
    loadSchools, handleSearch, selectStudent, backToSearch, handleSubmit,
    pendingUniformOrder,
    confirmReplaceOrder: () => {
      if (pendingStudentTarget && pendingUniformOrder) {
        setReplacePendingOrderId(pendingUniformOrder.id);
        selectStudent(pendingStudentTarget);
        setPendingUniformOrder(null);
        setPendingStudentTarget(null);
      }
    },
    confirmKeepAndAddOrder: () => {
      if (pendingStudentTarget) {
        setReplacePendingOrderId(null);
        selectStudent(pendingStudentTarget);
        setPendingUniformOrder(null);
        setPendingStudentTarget(null);
      }
    },
    cancelPendingModal: () => {
      setPendingUniformOrder(null);
      setPendingStudentTarget(null);
    },
  };
}

export type UniformOrder = ReturnType<typeof useUniformOrder>;
