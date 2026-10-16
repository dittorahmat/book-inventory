// No-any gate: gagalkan (exit 1) jika BARIS YANG DITAMBAHKAN
// (git staged / unstaged / untracked di bawah src/) mengandung `any`
// eksplisit. Utang lama tidak disentuh — baris lama boleh tetap, baris
// baru wajib `unknown` + narrowing atau tipe struktural minimal.
// Dijalankan via `bun run check:no-any` (lihat AGENTS.md aturan 9).
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PATTERNS = [
  /:\s*any\b/, // anotasi `: any` (termasuk `catch (err: any)`)
  /\bas\s+any\b/, // cast `as any`
  /<any[\s,>]/, // argumen generik `<any>` / `getJson<any>`
  /\bany\[\]/, // `any[]`
];

const norm = (p: string) => p.replace(/\\/g, "/");

function sh(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return null;
  }
}

type Hit = { file: string; line: string };

function scanLine(file: string, line: string, hits: Hit[]): void {
  const text = line.trim();
  if (text.startsWith("//") || text.startsWith("*") || text.startsWith("/*")) return;
  if (PATTERNS.some((re) => re.test(line))) hits.push({ file, line: text });
}

const hits: Hit[] = [];
const staged = sh("git diff --cached -U0 -- src");
const unstaged = sh("git diff -U0 -- src");

if (staged === null || unstaged === null) {
  console.log("No-any gate SKIP: bukan repo git — lewati.");
  process.exit(0);
}

for (const diff of [staged, unstaged]) {
  let file = "";
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ b/")) file = norm(raw.slice(6));
    else if (raw.startsWith("+") && !raw.startsWith("+++")) scanLine(file, raw.slice(1), hits);
  }
}

const status = sh("git status --porcelain -- src") ?? "";
for (const entry of status.split("\n")) {
  const m = entry.match(/^\?\?\s+(.+)$/);
  if (!m) continue;
  const file = norm(m[1].trim());
  if (!/\.(ts|tsx)$/.test(file)) continue;
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) scanLine(file, line, hits);
  } catch {
    continue;
  }
}

const seen = new Set<string>();
const unique = hits.filter((h) => {
  const key = `${h.file}::${h.line}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

if (unique.length > 0) {
  console.error("No-any gate FAILED (baris baru wajib tanpa `any` eksplisit):");
  for (const h of unique) console.error(`  ${h.file}: ${h.line}`);
  console.error("Ganti dengan `unknown` + narrowing atau tipe struktural minimal (AGENTS.md aturan 9).");
  process.exit(1);
}

console.log("No-any gate OK: tanpa `any` baru di baris yang ditambahkan.");
