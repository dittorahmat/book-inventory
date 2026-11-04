import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { requireScopedActor, accessErrorResponse } from "../services/access-scope";
import { parseStudentData } from "../../lib/student-import-parser";
import { fetchGoogleDriveResource } from "../services/drive-service";

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
    const res = await fetchGoogleDriveResource(url);

    if (!res.success) {
      return c.json({ success: false, message: res.message }, res.status);
    }

    if (res.type === "folder") {
      return c.json({
        success: true,
        type: "folder",
        data: res.data,
      });
    }

    const payload = res.data.buffer ?? res.data.csvText ?? "";
    const parseResult = parseStudentData(payload);
    return c.json({
      success: true,
      type: "sheet",
      data: parseResult,
    });
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});

