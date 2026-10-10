import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import {
  accessErrorResponse,
  loadLocationIds,
  requireAuthenticatedActor,
  resolveLocationScope,
  resolveRequestActor,
} from "../services/access-scope";
import { getSalesReport, salesReportToCsv } from "../services/sales-report";

/** Laporan penjualan per periode, sekolah, dan tipe paket-vs-satuan (spec: sales-report). */
export const salesReportRouter = new Hono();

const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal awal harus YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal akhir harus YYYY-MM-DD"),
  schoolId: z.string().min(1).optional(),
});

async function resolveReportScope(
  actor: Awaited<ReturnType<typeof resolveRequestActor>>,
  schoolId: string | undefined
): Promise<string[]> {
  const locations = await loadLocationIds(db);
  // Cakupan mengikuti isolasi peran: admin sekolah terkunci lokasinya.
  return resolveLocationScope(actor, schoolId, locations);
}

salesReportRouter.get("/", zValidator("query", reportQuerySchema), async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const { from, to, schoolId } = c.req.valid("query");
    const report = await getSalesReport({
      database: db,
      from,
      to,
      schoolIds: await resolveReportScope(actor, schoolId),
    });
    return c.json({ success: true, data: report });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

salesReportRouter.get("/csv", zValidator("query", reportQuerySchema), async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const { from, to, schoolId } = c.req.valid("query");
    const report = await getSalesReport({
      database: db,
      from,
      to,
      schoolIds: await resolveReportScope(actor, schoolId),
    });
    const csv = salesReportToCsv(report);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan-penjualan-${report.period.from}-sd-${report.period.to}.csv"`,
      },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
