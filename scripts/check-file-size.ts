// File-size gate: gagalkan (exit 1) jika ada file SUMBER melebihi batas,
// kecuali yang terdaftar di GRANDFATHERED (utang lama, dilunasi terpisah).
// Default: hanya file YANG DIUBAH (git staged / unstaged / untracked di bawah
// src/) — perilaku pre-commit. `--all` memindai seluruh pohon `src/` (dipakai
// CI agar gate tidak vakum pada checkout bersih). Dijalankan via
// `bun run check:file-size [--all]` (lihat AGENTS.md aturan 7).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ALL = process.argv.includes("--all");
const MAX_LINES = 400;
const EXCLUDE = [
  /\.test\.(ts|tsx)$/, // test dibatasi oleh bundel logikanya sendiri
  /(^|\/)db\/schema\.ts$/, // definisi skema tabular
  /(^|\/)server\/seed\.ts$/, // data seed tabular per-entity
  /\.d\.ts$/,
];

// Utang lama (>300 baris sebelum gate ada). Seluruh file telah dilunasi!
const GRANDFATHERED: string[] = [];

const norm = (p: string) => p.replace(/\\/g, "/");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(norm(full));
    }
  }
  return out;
}

function changedSourceFiles(): string[] | null {
  try {
    const out = execSync("git status --porcelain -- src", { encoding: "utf8" });
    const files = out
      .split("\n")
      .map((l) => l.trim().split(/\s+/).pop() || "")
      .filter((f) => f && /\.(ts|tsx)$/.test(f))
      .map(norm);
    return files;
  } catch {
    return null; // bukan repo git -> fallback ke full scan
  }
}

const changed = changedSourceFiles();
const candidates = ALL ? walk("src").map(norm) : changed ?? walk("src").map(norm);
const mode = ALL ? "full-tree (--all)" : "file yang diubah";

const offenders: Array<{ file: string; lines: number }> = [];
for (const file of candidates) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
  if (GRANDFATHERED.includes(file)) continue;
  let lines: number;
  try {
    lines = readFileSync(file, "utf8").split("\n").length;
  } catch {
    continue; // file dihapus setelah git status, abaikan
  }
  if (lines > MAX_LINES) offenders.push({ file, lines });
}

if (offenders.length > 0) {
  console.error(
    `File-size gate FAILED (maks ${MAX_LINES} baris, mode: ${mode}):`
  );
  for (const o of offenders.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${o.lines}  ${o.file}`);
  }
  console.error(
    "WAJIB pecah file di atas ke modul / utility / sub-komponen (AGENTS.md aturan 7)."
  );
  process.exit(1);
}

console.log(
  `File-size gate OK (mode: ${mode}): ${candidates.length} file diperiksa, semua <= ${MAX_LINES} baris.`
);
