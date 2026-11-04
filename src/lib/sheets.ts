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
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  } catch {
    return null;
  }
}
