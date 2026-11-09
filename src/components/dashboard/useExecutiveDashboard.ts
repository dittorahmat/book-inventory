import { useCallback, useEffect, useState } from "react";
import type { ExecutiveDashboardResponse, ExecutiveDashboardSummary } from "../../lib/dashboard-types";
import { apiEnvelope, ApiError, buildQuery } from "../../lib/api";

async function fetchExecutiveSummary(
  academicYear: string | null,
  compareAcademicYear: string | null,
): Promise<ExecutiveDashboardSummary> {
  const url = buildQuery("/api/dashboard/executive/summary", {
    academicYear: academicYear || undefined,
    compareAcademicYear: compareAcademicYear || undefined,
  });

  try {
    const body = await apiEnvelope<ExecutiveDashboardResponse>(url, undefined, "Gagal memuat ringkasan eksekutif.");
    if (!body.success || !body.data) {
      throw new Error(body.message || "Gagal memuat dashboard eksekutif.");
    }
    return body.data;
  } catch (err) {
    if (err instanceof Error) {
      const body = err instanceof ApiError ? (err.body as ExecutiveDashboardResponse | null) : null;
      if (body?.message) throw new Error(body.message);
      if (err.message === "Failed to fetch" || err.message.includes("fetch")) {
        throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet.");
      }
    }
    throw err;
  }
}

export function useExecutiveDashboard() {
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [compareAcademicYear, setCompareAcademicYear] = useState<string | null>(null);
  const [enableCompare, setEnableCompare] = useState(false);
  const [data, setData] = useState<ExecutiveDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchExecutiveSummary(
        academicYear,
        enableCompare ? compareAcademicYear : null,
      );
      setData(result);
      if (!academicYear) setAcademicYear(result.academicYear);
      if (enableCompare && !compareAcademicYear && result.compareAcademicYear) {
        setCompareAcademicYear(result.compareAcademicYear);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ringkasan eksekutif.");
    } finally {
      setIsLoading(false);
    }
  }, [academicYear, compareAcademicYear, enableCompare]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCompare = (enable: boolean) => {
    setEnableCompare(enable);
    if (enable && !compareAcademicYear && data?.availableAcademicYears) {
      const candidate = data.availableAcademicYears.find((y) => y !== (academicYear || data.academicYear));
      if (candidate) setCompareAcademicYear(candidate);
    }
  };

  return {
    data,
    isLoading,
    error,
    academicYear: academicYear || data?.academicYear || "2026/2027",
    compareAcademicYear: enableCompare ? (compareAcademicYear || data?.compareAcademicYear || null) : null,
    enableCompare,
    setAcademicYear,
    setCompareAcademicYear,
    toggleCompare,
    retry: load,
  };
}
