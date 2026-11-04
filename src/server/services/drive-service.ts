import {
  isGoogleDriveFolderUrl,
  normalizeGoogleSheetsUrl,
  parseGoogleDriveFolderHtml,
  type GoogleDriveFolderFile,
} from "../../lib/sheets";

export type DriveResourceResult =
  | { success: true; type: "folder"; data: { files: GoogleDriveFolderFile[]; totalFiles: number } }
  | { success: true; type: "sheet"; data: { csvText?: string; buffer?: ArrayBuffer } }
  | { success: false; message: string; status: 400 | 502 };

/**
 * Service seam tunggal untuk proxy request ke Google Drive folder publik atau file Google Sheets.
 * Berjalan aman di runtime Cloudflare Worker maupun Node/Bun tanpa dependensi shell/curl.
 */
// Cache in-memory berdurasi 5 menit untuk respons folder publik Google Drive
const folderCache = new Map<string, { data: { files: GoogleDriveFolderFile[]; totalFiles: number }; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchGoogleDriveResource(url: string): Promise<DriveResourceResult> {
  try {
    // 1. Google Drive Folder publik
    if (isGoogleDriveFolderUrl(url)) {
      const trimmedUrl = url.trim();
      const cached = folderCache.get(trimmedUrl);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return {
          success: true,
          type: "folder",
          data: cached.data,
        };
      }

      const resp = await fetch(trimmedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!resp.ok) {
        return {
          success: false,
          message: "Gagal mengakses folder Google Drive. Pastikan izin berbagi disetel publik (Anyone with link).",
          status: 400,
        };
      }
      const html = await resp.text();
      const files = parseGoogleDriveFolderHtml(html);
      const folderData = {
        files,
        totalFiles: files.length,
      };
      folderCache.set(trimmedUrl, { data: folderData, timestamp: Date.now() });

      return {
        success: true,
        type: "folder",
        data: folderData,
      };
    }

    // 2. Google Sheets publik (ekspor ke XLSX multi-sheet atau CSV)
    const exportUrl = normalizeGoogleSheetsUrl(url);
    if (exportUrl) {
      const resp = await fetch(exportUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,*/*",
        },
      });
      if (!resp.ok) {
        return {
          success: false,
          message: "Gagal mengunduh Google Sheets. Pastikan dokumen dapat diakses publik (Anyone with link).",
          status: 400,
        };
      }
      const isXlsx = exportUrl.includes("format=xlsx");
      const dataPayload = isXlsx ? await resp.arrayBuffer() : await resp.text();
      return {
        success: true,
        type: "sheet",
        data: {
          csvText: typeof dataPayload === "string" ? dataPayload : undefined,
          buffer: typeof dataPayload !== "string" ? dataPayload : undefined,
        },
      };
    }

    return {
      success: false,
      message: "URL bukan Google Sheets maupun Google Drive Folder yang valid.",
      status: 400,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Terjadi kendala jaringan saat mengakses Google Drive.",
      status: 502,
    };
  }
}
