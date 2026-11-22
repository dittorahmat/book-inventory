import { Hono } from "hono";
import { db } from "../../db";
import { PERIOD_RE } from "../lib/period";
import { accessErrorResponse, requireScopedActor } from "../services/access-scope";
import { buildReconciliation } from "../services/reconciliation";
import {
  buildReconciliationExcelBuffer,
  fetchBankTransferReconciliation,
} from "../services/reconciliation-excel";

export const reconciliationRouter = new Hono();

/** Rekonsiliasi per sekolah + periode: uang masuk wali ↔ tagihan cabang ↔ klaim. */
reconciliationRouter.get("/", async (c) => {
  try {
    const requested = c.req.query("schoolId");
    const { scope } = await requireScopedActor(db, c, requested);
    const schoolId = scope.length === 1 ? scope[0] : requested;
    const period = c.req.query("period") ?? "";
    if (!PERIOD_RE.test(period)) {
      return c.json({ success: false, message: "Periode wajib format YYYY-MM." }, 400);
    }
    return c.json({ success: true, data: await buildReconciliation(db, { period, schoolId }) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

/** Laporan tabular transfer bank & alokasi untuk finance. */
reconciliationRouter.get("/transfers", async (c) => {
  try {
    const rawRequested = c.req.query("schoolId");
    const requested = rawRequested === "all" ? undefined : rawRequested;
    const { scope } = await requireScopedActor(db, c, requested);
    const schoolId = scope.length === 1 ? scope[0] : requested;
    const period = c.req.query("period") ?? "";
    if (!PERIOD_RE.test(period)) {
      return c.json({ success: false, message: "Periode wajib format YYYY-MM." }, 400);
    }
    const rows = await fetchBankTransferReconciliation(db, { period, schoolId });
    return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

/** Ekspor Excel (.xlsx) laporan rekonsiliasi transfer bank untuk finance. */
reconciliationRouter.get("/transfers/export", async (c) => {
  try {
    const rawRequested = c.req.query("schoolId");
    const requested = rawRequested === "all" ? undefined : rawRequested;
    const { scope } = await requireScopedActor(db, c, requested);
    const schoolId = scope.length === 1 ? scope[0] : requested;
    const period = c.req.query("period") ?? "";
    if (!PERIOD_RE.test(period)) {
      return c.json({ success: false, message: "Periode wajib format YYYY-MM." }, 400);
    }
    const rows = await fetchBankTransferReconciliation(db, { period, schoolId });
    const buffer = buildReconciliationExcelBuffer(rows, period);
    const filename = `rekonsiliasi-finance-${period}${schoolId ? `-${schoolId}` : "-nasional"}.xlsx`;
    return new Response(buffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
