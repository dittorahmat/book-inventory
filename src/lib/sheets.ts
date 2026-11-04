export interface GoogleDriveFolderFile {
  id: string;
  name: string;
  type: "spreadsheet" | "folder";
}

/**
 * Mendeteksi apakah URL adalah folder Google Drive publik.
 */
export function isGoogleDriveFolderUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return (
      (parsed.hostname.includes("drive.google.com") || parsed.hostname.includes("docs.google.com")) &&
      parsed.pathname.includes("/folders/")
    );
  } catch {
    return false;
  }
}

/**
 * Mengekstrak berkas spreadsheet yang ada di dalam HTML publik folder Google Drive.
 */
export function parseGoogleDriveFolderHtml(html: string): GoogleDriveFolderFile[] {
  const regex = /\[\[null,"([a-zA-Z0-9_-]{25,})"\][^]*?\[\[\["([^"]+)"/g;
  const unique = new Map<string, GoogleDriveFolderFile>();
  let m: RegExpExecArray | null;

  while ((m = regex.exec(html)) !== null) {
    const id = m[1];
    const name = m[2];
    if (
      !unique.has(id) &&
      !name.includes("Name") &&
      !name.includes("Date modified") &&
      !name.includes("Google") &&
      !name.includes("Modified") &&
      !name.includes("Size:")
    ) {
      unique.set(id, {
        id,
        name,
        type: name.toLowerCase().includes("folder") ? "folder" : "spreadsheet",
      });
    }
  }

  return Array.from(unique.values());
}

/**
 * Utility bantuan untuk tautan Google Sheets publik.
 */
export function normalizeGoogleSheetsUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.includes("docs.google.com") || !parsed.pathname.includes("/spreadsheets/d/")) {
      return null;
    }
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const sheetId = match[1];

    // Ambil gid bila ada
    const gid = parsed.searchParams.get("gid") || parsed.hash.replace("#gid=", "");
    if (gid && /^\d+$/.test(gid)) {
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }
    // Jika tidak ada gid spesifik, ekspor seluruh workbook multi-sheet sebagai xlsx agar sheet numerik terbaca
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  } catch {
    return null;
  }
}

