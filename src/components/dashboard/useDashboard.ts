import { useCallback, useEffect, useState } from "react";
import type { DashboardSummaryPayload, DashboardSummaryResponse } from "../../lib/dashboard-types";
import { apiEnvelope, buildQuery } from "../../lib/api";

async function fetchDashboardSummary(
  schoolId: string | null
): Promise<NonNullable<DashboardSummaryResponse["data"]>> {
  const url = buildQuery("/api/dashboard/summary", { schoolId });

  try {
    const body = await apiEnvelope<DashboardSummaryResponse>(url, undefined, "Gagal memuat dashboard. Coba lagi.");
    if (!body.success || !body.data) {
      const ref = (body as { ref?: string }).ref ? ` (ref ${(body as { ref?: string }).ref})` : "";
      throw new Error(`${body.message || "Gagal memuat dashboard"}${ref} Coba lagi.`);
    }
    return body.data;
  } catch (err) {
    if (err instanceof Error) {
      const body = (err as { body?: DashboardSummaryResponse }).body;
      const ref = body && (body as { ref?: string }).ref ? ` (ref ${(body as { ref?: string }).ref})` : "";
      if (ref && !err.message.includes("ref")) throw new Error(`${err.message}${ref} Coba lagi.`);
      if (err.message === "Failed to fetch" || err.message.includes("fetch")) {
        throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
      }
    }
    throw err;
  }
}

export function useDashboard(schoolId: string | null) {
  const [data, setData] = useState<DashboardSummaryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchDashboardSummary(schoolId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat dashboard. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, retry: load };
}
