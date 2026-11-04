import { describe, it, expect } from "bun:test";
import { parseGoogleDriveFolderHtml, isGoogleDriveFolderUrl, normalizeGoogleSheetsUrl } from "./sheets";

describe("parseGoogleDriveFolderHtml", () => {
  it("accurately classifies folders vs spreadsheets without false positives on filenames containing 'folder'", () => {
    const mockHtml = `
      <div aria-label="AL-WILDAN 4 Shared folder"></div>
      <div aria-label="Folder Dokumen Siswa Folder"></div>
      <div aria-label="Folder dibagikan Baru Folder dibagikan"></div>
      [[null,"folder_id_12345678901234567890"]
      [[["AL-WILDAN 4"
      [[null,"sheet_id_123456789012345678901"]
      [[["Folder Rekap Buku 2026.xlsx"
      [[null,"sheet_id_123456789012345678902"]
      [[["Daftar Buku Siswa SD.xlsx"
    `;

    const items = parseGoogleDriveFolderHtml(mockHtml);

    const folderItem = items.find((i) => i.id === "folder_id_12345678901234567890");
    expect(folderItem).toBeDefined();
    expect(folderItem?.name).toBe("AL-WILDAN 4");
    expect(folderItem?.type).toBe("folder");

    // File dengan nama "Folder Rekap Buku 2026.xlsx" tidak boleh salah diklasifikasikan sebagai folder!
    const sheetWithFolderInName = items.find((i) => i.id === "sheet_id_123456789012345678901");
    expect(sheetWithFolderInName).toBeDefined();
    expect(sheetWithFolderInName?.name).toBe("Folder Rekap Buku 2026.xlsx");
    expect(sheetWithFolderInName?.type).toBe("spreadsheet");

    const normalSheet = items.find((i) => i.id === "sheet_id_123456789012345678902");
    expect(normalSheet).toBeDefined();
    expect(normalSheet?.type).toBe("spreadsheet");
  });

  it("identifies valid google drive folder and sheets URLs correctly", () => {
    expect(isGoogleDriveFolderUrl("https://drive.google.com/drive/folders/152wjA7d62NmlnRhNAkdR_FNX1igGf4wQ")).toBe(true);
    expect(isGoogleDriveFolderUrl("https://docs.google.com/spreadsheets/d/abc/edit")).toBe(false);

    expect(normalizeGoogleSheetsUrl("https://docs.google.com/spreadsheets/d/test-id/edit#gid=123")).toBe(
      "https://docs.google.com/spreadsheets/d/test-id/export?format=csv&gid=123"
    );
    expect(normalizeGoogleSheetsUrl("https://docs.google.com/spreadsheets/d/test-id/edit")).toBe(
      "https://docs.google.com/spreadsheets/d/test-id/export?format=xlsx"
    );
  });
});
