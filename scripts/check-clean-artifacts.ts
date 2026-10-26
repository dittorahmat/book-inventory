// Gate artefak bersih & anti-blob liar (AGENTS.md Mandat Anti-Kambuh §0.17):
// Memastikan tidak ada file biner atau dokumen presentasi/ekspor PDF/DOCX yang ter-commit ke git.
import { execFileSync } from "node:child_process";

const staged = process.argv.includes("--staged");

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" });
const lines = (...args: string[]): string[] =>
  git(...args)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\\/g, "/"));

const files = staged
  ? lines("diff", "--cached", "--name-only", "--diff-filter=ACM")
  : lines("ls-files");

// Ekstensi dokumen biner/non-source liar yang dilarang berada dalam git tree
const BANNED_EXTENSIONS = [
  /\.(pdf|docx?|xlsx?|pptx?)$/i,
  /\.(exe|dll|dylib|so)$/i,
  /\.(zip|tar|gz|7z|rar)$/i,
];

// Pengecualian sah jika ada aset yang sudah grandfathered atau di public/
const GRANDFATHERED = new Set(["docs/USER_MANUAL.pdf"]);

const isAllowed = (file: string): boolean => {
  return file.startsWith("public/") || file.startsWith("dist/") || GRANDFATHERED.has(file);
};

const violations: string[] = [];
for (const file of files) {
  if (isAllowed(file)) continue;
  if (BANNED_EXTENSIONS.some((ext) => ext.test(file))) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error("Clean-artifacts gate FAILED: File biner/dokumen terlarang terdeteksi di git tracking:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.error("Dokumentasi dan spesifikasi sistem wajib berformat teks markdown (.md). Hapus file di atas sebelum commit.");
  process.exit(1);
}

console.log(`Clean-artifacts gate OK: ${files.length} file dipindai, bebas dari dokumen biner terlarang.`);
