// Gate deteksi path lokal absolut host (misal "D:/...", "C:\...") pada file kode/skrip/test.
// Mencegah ketergantungan path lokal mesin pengembang yang merusak CI dan mesin lain (§0.58).
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const allMode = args.includes("--all");

const git = (...gitArgs: string[]): string => execFileSync("git", gitArgs, { encoding: "utf8" });
const lines = (...gitArgs: string[]): string[] =>
  git(...gitArgs)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/\\/g, "/"));

const filesToScan: string[] = allMode
  ? lines("ls-files", "src/", "scripts/", "test/")
  : [...new Set([
      ...lines("diff", "--name-only", "--diff-filter=ACM"),
      ...lines("diff", "--cached", "--name-only", "--diff-filter=ACM"),
      ...lines("ls-files", "--others", "--exclude-standard"),
    ])].filter((f) => /^(src|scripts|test)\/.*\.(ts|tsx|js|mjs)$/.test(f));

const HOST_PATH_PATTERN = /(?:["'`])([a-zA-Z]:[\\/][^"'`\r\n]+)(?:["'`])/g;

let violations = 0;

for (const file of filesToScan) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf-8");
  const fileLines = content.split(/\r?\n/);

  fileLines.forEach((lineText, idx) => {
    // Lewati baris komentar penjelasan atau regex pattern itu sendiri
    if (lineText.trim().startsWith("//") || lineText.trim().startsWith("*")) return;
    if (lineText.includes("HOST_PATH_PATTERN")) return;

    let match: RegExpExecArray | null;
    HOST_PATH_PATTERN.lastIndex = 0;
    while ((match = HOST_PATH_PATTERN.exec(lineText)) !== null) {
      console.error(
        `❌ check:no-hardcoded-paths: Terdeteksi path host absolut di ${file}:${idx + 1}\n` +
        `   Path: "${match[1]}"\n` +
        `   Gunakan parameter CLI (process.argv), env var, atau path relatif repositori (./data/...).`
      );
      violations++;
    }
  });
}

if (violations > 0) {
  console.error(`\nHardcoded-paths gate FAILED: ${violations} pelanggaran path host ditemukan (lihat §0.58).`);
  process.exit(1);
}

console.log(`Hardcoded-paths gate OK: ${filesToScan.length} file dipindai, bebas dari path host absolut.`);
