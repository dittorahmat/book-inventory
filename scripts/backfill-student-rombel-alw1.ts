import { parseStudentData } from "../src/lib/student-import-parser";
import * as fs from "node:fs";
import * as path from "node:path";

function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function resolveStudentFilePath(): string {
  const argPath = process.argv[2];
  const envPath = process.env.STUDENT_FILE_PATH;
  const defaultRelative = path.resolve("./data/DATA_SISWA_SD_ALW1.xlsm");

  const candidate = argPath || envPath || defaultRelative;
  if (!fs.existsSync(candidate)) {
    throw new Error(
      `File data siswa tidak ditemukan di: "${candidate}".\n` +
      `Silakan berikan argumen path CLI atau atur env var STUDENT_FILE_PATH.\n` +
      `Contoh: bun scripts/backfill-student-rombel-alw1.ts /path/ke/file.xlsm`
    );
  }
  return candidate;
}

export function generateBackfillRombelUpdates(buffer: Buffer, nowIso: string = new Date().toISOString()): string[] {
  const result = parseStudentData(buffer.buffer);
  return result.validStudents
    .filter((s) => s.rombel)
    .map((s) => {
      return `UPDATE students SET rombel = ${escapeSql(s.rombel)}, updated_at = ${escapeSql(nowIso)} WHERE school_id = 'school-alw-1' AND lower(nis) = ${escapeSql(s.nis.trim().toLowerCase())};`;
    });
}

function main() {
  const filePath = resolveStudentFilePath();
  console.log(`[backfill-rombel] Membaca file data siswa dari: ${filePath}`);
  const buf = fs.readFileSync(filePath);
  const updates = generateBackfillRombelUpdates(buf);

  const outDir = path.resolve("./data/sql");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "backfill-student-rombel-alw1.sql");
  fs.writeFileSync(outPath, updates.join("\n"), "utf-8");
  console.log(`[backfill-rombel] Menghasilkan ${updates.length} perintah UPDATE di: ${outPath}`);
}

if (import.meta.main) {
  main();
}
