import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
  const [notes, setNotes] = useState("");
  const [orderType, setOrderType] = useState<"regular" | "scholarship">("regular");
  const [scholarshipProof, setScholarshipProof] = useState("");
  const [satuanOpen, setSatuanOpen] = useState(true);
  const [step, setStep] = useState<UniformStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string; total: number } | null>(null);

  const search = useStudentSearch<UniformStudent>({
    schools,
    onSelectStudent: (s) => selectStudent(s),
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
      if (!satuan.open) setSatuanQty({});
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
    setNotes("");
    setOrderType("regular");
    setScholarshipProof("");
    setSuccess(null);
    setStep(1);
  };

  const canSubmit =
    itemCount > 0 &&
    validateHomeAddress(address).ok &&
    (orderType === "regular" || scholarshipProof !== "") &&
    Object.entries(satuanQty).every(([key]) => {
      const variantId = key.split("::")[0];
      const variant = catalog?.variants.find((v) => v.id === variantId);
      return variant?.kind !== "olahraga" || key.split("::")[1] !== undefined;
    }) &&
    Object.keys(packageQty).every((pkgId) => {
      const pkg = catalog?.packages.find((p) => p.id === pkgId);
      const needsSize = pkg?.bom.some((b) => {
        const v = catalog?.variants.find((x) => x.id === b.variantId);
        return v?.kind === "olahraga" && b.size === "—";
      });
      return !needsSize || (sizeFor[pkgId] ?? "") !== "";
    });

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
        homeAddress: address.trim(),
        items,
        sizeOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        notes: notes.trim() || undefined,
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
    address, setAddress, notes, setNotes, step, setStep,
    orderType, setOrderType, scholarshipProof, setScholarshipProof, satuanOpen,
    submitting, error, setError, success, total, itemCount, canSubmit,
    loadSchools, handleSearch, selectStudent, backToSearch, handleSubmit,
  };
}

export type UniformOrder = ReturnType<typeof useUniformOrder>;
