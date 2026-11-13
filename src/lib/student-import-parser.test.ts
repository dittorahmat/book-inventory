import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { normalizeAlWildanClass, normalizeGoogleSheetsUrl, parseStudentData } from "./student-import-parser";

describe("student-import-parser", () => {
  it("normalizes Al-Wildan class notation correctly", () => {
    expect(normalizeAlWildanClass("1.INTER 1")).toEqual({ gradeLevel: "1", curriculumType: "INTER", stream: undefined, rombel: "INTER 1" });
    expect(normalizeAlWildanClass("2.MQ 2")).toEqual({ gradeLevel: "2", curriculumType: "MQ", stream: undefined, rombel: "MQ 2" });
    expect(normalizeAlWildanClass("3.INTER 6")).toEqual({ gradeLevel: "3", curriculumType: "INTER", stream: undefined, rombel: "INTER 6" });
    expect(normalizeAlWildanClass("6.MQ 1")).toEqual({ gradeLevel: "6", curriculumType: "MQ", stream: undefined, rombel: "MQ 1" });
    expect(normalizeAlWildanClass("10-AE IPA")).toEqual({ gradeLevel: "10", curriculumType: "AE", stream: "IPA", rombel: "AE IPA" });
    expect(normalizeAlWildanClass("11-AE IPS")).toEqual({ gradeLevel: "11", curriculumType: "AE", stream: "IPS", rombel: "AE IPS" });
    expect(normalizeAlWildanClass("Cuti")).toEqual({ gradeLevel: null, curriculumType: "INTER" });
    expect(normalizeAlWildanClass("Kelas 4")).toEqual({ gradeLevel: "4", curriculumType: "INTER", stream: undefined, rombel: undefined });
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
    expect(result.validStudents[0].rombel).toBe("INTER 1");
    expect(result.validStudents[0].curriculumType).toBe("INTER");
    expect(result.validStudents[1].gender).toBe("female");
    expect(result.validStudents[1].rombel).toBe("MQ 1");
    expect(result.validStudents[1].curriculumType).toBe("MQ");
    expect(result.skippedRows[0].reason).toContain("Cuti");
  });

  it("successfully parses real .xlsm file with 714 students if file exists locally", () => {
    const filePath = process.env.STUDENT_FILE_PATH || "./data/DATA_SISWA_SD_ALW1.xlsm";
    if (!existsSync(filePath)) {
      // Di CI / lingkungan Linux, berkas lokal tidak ada
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
    expect(first.curriculumType).toBe("INTER");
    expect(first.intakeType).toBe("baru");
    expect(first.gender).toBe("male");
  });
});
