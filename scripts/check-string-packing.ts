// Memblokir pola darurat string-packing domain fields (seperti [WA: ...] atau
// [PENGUNDURAN DIRI]) ke dalam kolom teks catatan/alasan bebas, sesuai Mandat
// Anti-Kambuh AGENTS.md §0.10: field domain wajib kolom skema resmi.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ALL = process.argv.includes("--all");
const PACKING_PATTERN =
  /\[(WA|WhatsApp|Surat|Bukti|Finance|Resi|Beasiswa|PENGUNDURAN DIRI|Retur)\b[^\]]*\]/i;

const norm = (p: string) => p.replace(/\\/g, "/");

function walk(dir: string, fileList: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, fileList);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      fileList.push(norm(full));
    }
  }
  return fileList;
}

function getTargetFiles(): string[] {
  if (ALL) {
    return walk(join(process.cwd(), "src", "server"));
  }
  try {
    const out = execSync("git status --porcelain -- src/server", { encoding: "utf8" });
    const changed = out
      .split(/\r?\n/)
      .map((l) => l.trim().split(/\s+/).pop() || "")
      .filter((f) => f && /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
      .map(norm)
      .filter((f) => existsSync(f));
    return changed;
  } catch {
    return walk(join(process.cwd(), "src", "server"));
  }
}

const files = getTargetFiles();
const violations: Array<{ file: string; line: number; match: string }> = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    const match = lineText.match(PACKING_PATTERN);
    if (match) {
      violations.push({
        file,
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

console.log(`String-packing gate OK (${ALL ? "all" : `${files.length} file berubah`}): tidak ada tag darurat domain di teks catatan.`);
