// No-any gate: gagalkan (exit 1) jika BARIS YANG DITAMBAHKAN
// (git staged / unstaged / untracked di bawah src/) mengandung `any`
// eksplisit. Utang lama tidak disentuh — baris lama boleh tetap, baris
// baru wajib `unknown` + narrowing atau tipe struktural minimal.
// Dijalankan via `bun run check:no-any` (lihat AGENTS.md aturan 9).
// `--base=<ref>` (atau env GATE_BASE_REF) membuat gate juga memeriksa baris
// yang ditambahkan pada diff PR — di CI checkout bersih diff lokal selalu kosong.
import { baseRefFromArgv, changedLines } from "./lib/changed-lines";

const PATTERNS = [
  /:\s*any\b/, // anotasi `: any` (termasuk `catch (err: any)`)
  /\bas\s+any\b/, // cast `as any`
  /<any[\s,>]/, // argumen generik `<any>` / `getJson<any>`
  /\bany\[\]/, // `any[]`
];

const isTsFile = (file: string): boolean => /\.(ts|tsx)$/.test(file);

const isComment = (trimmed: string): boolean =>
  trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");

const lines = changedLines("src", isTsFile, { base: baseRefFromArgv(process.argv) });
if (lines === null) {
  console.log("No-any gate SKIP: bukan repo git — lewati.");
  process.exit(0);
}

const seen = new Set<string>();
const hits = lines
  .map(({ file, line }) => ({ file, line: line.trim() }))
  .filter(({ file, line }) => {
    if (isComment(line)) return false;
    if (!PATTERNS.some((re) => re.test(line))) return false;
    const key = `${file}::${line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

if (hits.length > 0) {
  console.error("No-any gate FAILED (baris baru wajib tanpa `any` eksplisit):");
  for (const hit of hits) console.error(`  ${hit.file}: ${hit.line}`);
  console.error("Ganti dengan `unknown` + narrowing atau tipe struktural minimal (AGENTS.md aturan 9).");
  process.exit(1);
}

console.log("No-any gate OK: tanpa `any` baru di baris yang ditambahkan.");
