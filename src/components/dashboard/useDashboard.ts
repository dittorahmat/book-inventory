import { useCallback, useEffect, useState } from "react";
import type { DashboardSummaryPayload } from "../../lib/dashboard-types";
import { fetchDashboardSummary } from "./dashboard-api";

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
