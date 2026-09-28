// File-size gate: gagalkan (exit 1) jika ada file SUMBER YANG DIUBAH
// (git staged / unstaged / untracked di bawah src/) melebihi batas.
// File lama yang tidak disentuh tidak memblokir, tapi sekali disentuh
// wajib ikut dipecah. Dijalankan via `bun run check:file-size`
// (lihat AGENTS.md aturan 7).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const MAX_LINES = 300;
const EXCLUDE = [
  /\.test\.(ts|tsx)$/, // test dibatasi oleh bundel logikanya sendiri
  /(^|\/)db\/schema\.ts$/, // definisi skema tabular
  /(^|\/)server\/seed\.ts$/, // data seed tabular per-entity
  /\.d\.ts$/,
];

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
const candidates = changed ?? walk("src").map(norm);

const offenders: Array<{ file: string; lines: number }> = [];
for (const file of candidates) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
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
    `File-size gate FAILED (maks ${MAX_LINES} baris per file yang diubah):`
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
  `File-size gate OK: ${candidates.length} file diubah diperiksa, semua <= ${MAX_LINES} baris.`
);
