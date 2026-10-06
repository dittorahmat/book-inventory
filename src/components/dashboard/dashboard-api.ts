import type { DashboardSummaryResponse } from "../../lib/dashboard-types";

export async function fetchDashboardSummary(
  schoolId: string | null,
): Promise<NonNullable<DashboardSummaryResponse["data"]>> {
  const url = schoolId
    ? `/api/dashboard/summary?schoolId=${encodeURIComponent(schoolId)}`
    : "/api/dashboard/summary";

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  let body: DashboardSummaryResponse;
  try {
    body = await res.json();
  } catch {
    throw new Error("Respons server tidak valid. Coba muat ulang halaman.");
  }

  if (!res.ok || !body.success || !body.data) {
    const ref = (body as { ref?: string }).ref ? ` (ref ${(body as { ref?: string }).ref})` : "";
    throw new Error(`${body.message || `Gagal memuat dashboard (kode ${res.status})`}${ref} Coba lagi.`);
  }
  return body.data;
}
