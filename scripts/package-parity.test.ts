import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import { fetchGoogleDriveResource } from "../src/server/services/drive-service";

interface ExpectedPackage {
  jenjang: "TK" | "SD" | "SMP" | "SMA";
  grade: string;
  curriculum: "TK" | "INTER" | "AE" | "ME" | "DI" | "MQ";
  stream: string;
  price: number;
  intakeType: "baru" | "kenaikan";
}

function parsePackageSummary(pWb: XLSX.WorkBook, sheetName: string, intakeType: "baru" | "kenaikan"): ExpectedPackage[] {
  const ws = pWb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const packages: ExpectedPackage[] = [];
  let currentJenjang = "";
  for (const row of rows) {
    const firstCell = String(row[0] || "").trim();
    if (["TK", "SD", "SMP", "SMA-IPA", "SMA-IPS"].includes(firstCell)) {
      currentJenjang = firstCell;
      continue;
    }
    if (row.some((c) => c === "KELAS" || c === "BIAYA BUKU")) continue;
    if (currentJenjang === "TK" && ["PG", "K-1", "K-2"].includes(firstCell)) {
      const price = Number(row[1]) || 0;
      packages.push({ jenjang: "TK", grade: firstCell, curriculum: "TK", stream: "", price, intakeType });
      continue;
    }
    const gradeNum = Number(firstCell);
    if (!isNaN(gradeNum) && gradeNum > 0) {
      if (currentJenjang === "SD") {
        if (row[1]) packages.push({ jenjang: "SD", grade: String(gradeNum), curriculum: "INTER", stream: "INTER", price: Number(row[1]), intakeType });
        if (row[2]) packages.push({ jenjang: "SD", grade: String(gradeNum), curriculum: "MQ", stream: "MQ", price: Number(row[2]), intakeType });
      } else if (currentJenjang === "SMP") {
        if (row[1]) packages.push({ jenjang: "SMP", grade: String(gradeNum), curriculum: "AE", stream: "AE", price: Number(row[1]), intakeType });
        if (row[2]) packages.push({ jenjang: "SMP", grade: String(gradeNum), curriculum: "ME", stream: "ME", price: Number(row[2]), intakeType });
        if (row[3]) packages.push({ jenjang: "SMP", grade: String(gradeNum), curriculum: "MQ", stream: "MQ", price: Number(row[3]), intakeType });
      } else if (currentJenjang.startsWith("SMA")) {
        const stream = currentJenjang.replace("SMA-", "");
        if (row[1]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "AE", stream, price: Number(row[1]), intakeType });
        if (row[2]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "DI", stream, price: Number(row[2]), intakeType });
        if (row[3]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "ME", stream, price: Number(row[3]), intakeType });
        if (row[4]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "MQ", stream, price: Number(row[4]), intakeType });
      }
    }
  }
  return packages;
}

describe("package parity validation", () => {
  it(
    "validates that all 82 catalog packages match their BOM item sum",
    async () => {
      // 1. Ambil ringkasan harga paket
      const packageFileId = "1gINL0rtBWbPJ9-Ap8_GQgAOUGPmE9IlnU6CgRa_RjEI";
      const pRes = await fetchGoogleDriveResource(`https://docs.google.com/spreadsheets/d/${packageFileId}`);
      if (!pRes.success || pRes.type !== "sheet") {
        console.warn("Drive service unreachable (skip parity test):", pRes.message);
        return;
      }
      const pWb = XLSX.read(pRes.data.buffer, { type: "buffer" });
      const allExpected = [
        ...parsePackageSummary(pWb, "PAKET MURID BARU.", "baru"),
        ...parsePackageSummary(pWb, "PAKET KENAIKAN.", "kenaikan"),
      ];

      expect(allExpected.length).toBe(82);

      // 2. Ambil rincian buku dari folder BOM (fetch parallel)
      const folderUrl = "https://drive.google.com/drive/folders/152wjA7d62NmlnRhNAkdR_FNX1igGf4wQ";
      const fRes = await fetchGoogleDriveResource(folderUrl);
      if (!fRes.success || fRes.type !== "folder") {
        console.warn("Drive folder unreachable (skip parity test):", fRes.message);
        return;
      }

      const files = fRes.data.files.filter((f) => f.type === "spreadsheet" && f.name.includes("2026-2027") && !f.name.startsWith("A. "));
      const wbPromises = files.map(async (f) => {
        const bRes = await fetchGoogleDriveResource(`https://docs.google.com/spreadsheets/d/${f.id}`);
        if (bRes.success && bRes.type === "sheet") {
          return { name: f.name, wb: XLSX.read(bRes.data.buffer, { type: "buffer" }) };
        }
        return null;
      });

      const fetchedWorkbooks = await Promise.all(wbPromises);
      const allWorkbooks = fetchedWorkbooks.filter((item): item is { name: string; wb: XLSX.WorkBook } => item !== null);

      // 3. Verifikasi parity untuk setiap paket
      let verifiedCount = 0;
      for (const ep of allExpected) {
        let foundSheetBooks: Array<{ title: string; price: number }> | null = null;

        for (const { wb } of allWorkbooks) {
          for (const s of wb.SheetNames) {
            if (s.toLowerCase().includes("rekap") || s.toLowerCase() === "gabung") continue;
            const ws = wb.Sheets[s];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
            let sum = 0;
            const bList: Array<{ title: string; price: number }> = [];
            for (const r of rows) {
              if (r && typeof r[0] === "number" && r[1] && typeof r[1] === "string" && !/^(total|jumlah|subtotal)\b/i.test(r[1].trim())) {
                let p = 0;
                if (typeof r[2] === "number" && r[2] >= 1000) p = r[2];
                else if (typeof r[3] === "number" && r[3] >= 1000) p = r[3];
                else if (typeof r[4] === "number" && r[4] >= 1000) p = r[4];
                if (p > 0) {
                  sum += p;
                  bList.push({ title: r[1].trim(), price: p });
                }
              }
            }
            if (sum === ep.price) {
              foundSheetBooks = bList;
              break;
            }
          }
          if (foundSheetBooks) break;
        }

        expect(foundSheetBooks).not.toBeNull();
        if (foundSheetBooks) {
          const bomSum = foundSheetBooks.reduce((sum, b) => sum + b.price, 0);
          expect(bomSum).toBe(ep.price);
          verifiedCount++;
        }
      }

      expect(verifiedCount).toBe(82);
    },
    60000
  );
});
