import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { normalizeAlWildanClass, normalizeGoogleSheetsUrl, parseStudentData } from "./student-import-parser";

describe("student-import-parser", () => {
  it("normalizes Al-Wildan class notation correctly", () => {
    expect(normalizeAlWildanClass("1.INTER 1")).toEqual({ gradeLevel: "1", curriculumType: "international" });
    expect(normalizeAlWildanClass("2.MQ 2")).toEqual({ gradeLevel: "2", curriculumType: "national" });
    expect(normalizeAlWildanClass("3.INTER 6")).toEqual({ gradeLevel: "3", curriculumType: "international" });
    expect(normalizeAlWildanClass("6.MQ 1")).toEqual({ gradeLevel: "6", curriculumType: "national" });
    expect(normalizeAlWildanClass("Cuti")).toEqual({ gradeLevel: null, curriculumType: "international" });
    expect(normalizeAlWildanClass("Kelas 4")).toEqual({ gradeLevel: "4", curriculumType: "international" });
  });

  it("normalizes Google Sheets URLs to CSV export format", () => {
    const rawUrl = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?gid=0#gid=0";
    const csvUrl = normalizeGoogleSheetsUrl(rawUrl);
    expect(csvUrl).toBe("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=0");

    const simpleUrl = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit";
    expect(normalizeGoogleSheetsUrl(simpleUrl)).toBe("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=xlsx");

    expect(normalizeGoogleSheetsUrl("https://example.com/sheet")).toBeNull();
  });

  it("parses CSV string data correctly", () => {
    const csv = [
      "nis,nama,kelas,jk",
      "1001,Ahmad Yani,1.INTER 1,Male",
      "1002,Fatimah Azzahra,2.MQ 1,Female",
      "1003,Sofia Yusufi,Cuti,Female",
    ].join("\n");

    const result = parseStudentData(csv);
    expect(result.validStudents.length).toBe(2);
    expect(result.skippedRows.length).toBe(1);
    expect(result.validStudents[0].nis).toBe("1001");
    expect(result.validStudents[0].gradeLevel).toBe("1");
    expect(result.validStudents[0].curriculumType).toBe("international");
    expect(result.validStudents[1].gender).toBe("female");
    expect(result.validStudents[1].curriculumType).toBe("national");
    expect(result.skippedRows[0].reason).toContain("Cuti");
  });

  it("successfully parses real .xlsm file with 714 students if file exists locally", () => {
    const filePath = "D:\\development\\DATA SISWA SD AL-WILDAN 1 TP. 2026-2027.xlsm";
    if (!existsSync(filePath)) {
      // Di CI / lingkungan Linux, berkas lokal di drive D: host Windows tidak ada
      return;
    }
    const buffer = readFileSync(filePath);
    const result = parseStudentData(buffer.buffer);

    expect(result.sheetName).toBe("DT-SSW");
    expect(result.validStudents.length).toBe(713); // 714 total - 1 Cuti
    expect(result.skippedRows.length).toBe(1); // 1 Sofia Yusufi Cuti
    expect(result.skippedRows[0].reason).toContain("Cuti");

    // Spot-check first student
    const first = result.validStudents[0];
    expect(first.nis).toBe("262710001");
    expect(first.name).toBe("ABIZAR ZAFRAN BINTORO");
    expect(first.gradeLevel).toBe("1");
    expect(first.curriculumType).toBe("international");
    expect(first.gender).toBe("male");
  });
});
