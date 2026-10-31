// Memblokir pola darurat string-packing domain fields (seperti [WA: ...] atau
// [PENGUNDURAN DIRI]) ke dalam kolom teks catatan/alasan bebas, sesuai Mandat
// Anti-Kambuh AGENTS.md §0.10: field domain wajib kolom skema resmi.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PACKING_PATTERN =
  /\[(WA|WhatsApp|Surat|Bukti|Finance|Resi|Beasiswa|PENGUNDURAN DIRI|Retur)\b[^\]]*\]/i;

function walk(dir: string, fileList: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, fileList);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      fileList.push(full);
    }
  }
  return fileList;
}

const files = walk(join(process.cwd(), "src", "server"));
const violations: Array<{ file: string; line: number; match: string }> = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    const match = lineText.match(PACKING_PATTERN);
    if (match) {
      violations.push({
        file: file.replace(/\\/g, "/"),
        line: idx + 1,
        match: match[0],
      });
    }
  });
}

if (violations.length > 0) {
  console.error("String-packing gate GAGAL: Ditemukan pola tag darurat pada teks bebas:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.match}`);
  }
  console.error("\nMandat AGENTS.md §0.10: Alokasikan field domain ke kolom skema resmi atau objek terstruktur, jangan dipadatkan ke catatan/notes.");
  process.exit(1);
}

console.log("String-packing gate OK: tidak ada tag darurat domain di teks catatan.");
