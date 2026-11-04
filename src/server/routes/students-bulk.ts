import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { requireScopedActor, accessErrorResponse } from "../services/access-scope";
import { isGoogleDriveFolderUrl, normalizeGoogleSheetsUrl, parseGoogleDriveFolderHtml } from "../../lib/sheets";
import { parseStudentData } from "../../lib/student-import-parser";

export const studentsBulkRouter = new Hono();

const parseDriveUrlPayloadSchema = z
  .object({
    url: z.string().url("URL tidak valid"),
  })
  .strict();


/**
 * Endpoint server-side untuk parsing Google Drive Folder atau Google Sheets URL murid.
 * Mencegah CORS browser dan mengekstrak file spreadsheet atau CSV data murid.
 */
studentsBulkRouter.post("/parse-drive-url", zValidator("json", parseDriveUrlPayloadSchema), async (c) => {
  try {
    const { actor } = await requireScopedActor(db, c);
    if (!actor) {
      return c.json({ success: false, message: "Akses ditolak." }, 403);
    }

    const { url } = c.req.valid("json");

    // Kasus 1: URL adalah Google Drive Folder
    if (isGoogleDriveFolderUrl(url)) {
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resp.ok) {
        return c.json({ success: false, message: "Gagal mengakses folder Google Drive. Pastikan izin publik." }, 400);
      }
      const html = await resp.text();
      const files = parseGoogleDriveFolderHtml(html);
      return c.json({
        success: true,
        type: "folder",
        data: {
          files,
          totalFiles: files.length,
        },
      });
    }

    // Kasus 2: URL adalah Google Sheets langsung
    const exportUrl = normalizeGoogleSheetsUrl(url);
    if (exportUrl) {
      const resp = await fetch(exportUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resp.ok) {
        return c.json({ success: false, message: "Gagal mengunduh Google Sheets. Pastikan akses diatur publik." }, 400);
      }
      const csvText = await resp.text();
      const parseResult = parseStudentData(csvText);
      return c.json({
        success: true,
        type: "sheet",
        data: parseResult,
      });
    }

    return c.json({ success: false, message: "URL bukan Google Sheets maupun Google Drive Folder yang valid." }, 400);
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});
