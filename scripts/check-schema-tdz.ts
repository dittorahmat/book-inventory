import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../src/db/schema.ts");

const content = readFileSync(schemaPath, "utf-8");
const lines = content.split("\n");

let firstTableLine = -1;
const lateEnums: { name: string; line: number }[] = [];

// Pola konstanta enum/array yang kerap direferensikan dalam definisi tabel
const enumArrayRegex = /^export const ([A-Z0-9_]+)\s*=\s*(\[|.*as const)/;
const tableRegex = /^export const \w+\s*=\s*sqliteTable\(/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (firstTableLine === -1 && tableRegex.test(line)) {
    firstTableLine = i + 1;
  }
  const match = line.match(enumArrayRegex);
  if (match) {
    const constName = match[1];
    // Hanya periksa konstanta bertipe UPPERCASE_SNAKE yang dideklarasikan setelah tabel pertama
    if (firstTableLine !== -1 && constName.toUpperCase() === constName && !constName.endsWith("_TABLE")) {
      // Kecualikan relasi / skema non-enum jika ada
      if (constName.includes("TYPES") || constName.includes("STATUSES") || constName.includes("OPTIONS") || constName.includes("ROLES") || constName.includes("STREAMS")) {
        lateEnums.push({ name: constName, line: i + 1 });
      }
    }
  }
}

if (lateEnums.length > 0) {
  console.error("Schema TDZ check FAILED: Konstanta enum/tipe skema didefinisikan setelah definisi tabel.");
  console.error(`Tabel pertama ditemukan di baris ${firstTableLine}.`);
  for (const item of lateEnums) {
    console.error(`  - ${item.name} di baris ${item.line}`);
  }
  console.error("Pindahkan seluruh enum/array konstanta ke bagian teratas src/db/schema.ts untuk mencegah crash TDZ saat drizzle-kit generate.");
  process.exit(1);
}

console.log("Schema TDZ check OK: Seluruh enum/array skema dideklarasikan sebelum tabel.");
