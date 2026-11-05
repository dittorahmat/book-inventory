// Gate migrasi D1 destruktif (§0.57).
// Melarang pernyataan `DROP TABLE` pada berkas migrasi baru di `drizzle/0*.sql`
// untuk mencegah kehilangan data atau Foreign Key constraint failure pada Cloudflare D1.
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

const migrationFiles: string[] = allMode
  ? lines("ls-files", "drizzle/").filter((f) => /^drizzle\/0\d{3}_.*\.sql$/.test(f))
  : [...new Set([
      ...lines("diff", "--name-only", "--diff-filter=ACM"),
      ...lines("diff", "--cached", "--name-only", "--diff-filter=ACM"),
      ...lines("ls-files", "--others", "--exclude-standard"),
    ])].filter((f) => /^drizzle\/0\d{3}_.*\.sql$/.test(f));

let violations = 0;

for (const file of migrationFiles) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf-8");
  const fileLines = content.split(/\r?\n/);

  fileLines.forEach((lineText, idx) => {
    const trimmed = lineText.trim();
    if (trimmed.startsWith("--")) return; // komentar SQL
    if (/\bDROP\s+TABLE\b/i.test(trimmed)) {
      console.error(
        `❌ check:d1-destructive: Drizzle recreation / DROP TABLE terdeteksi di ${file}:${idx + 1}\n` +
        `   Pernyataan: "${trimmed}"\n` +
        `   DROP TABLE pada migrasi D1 remote berisiko merusak integritas relasional dan dilarang (§0.57).\n` +
        `   Sederhanakan migrasi menjadi ALTER TABLE non-destruktif atau ajukan rencana expand-contract dua PR (ADR-0013).`
      );
      violations++;
    }
  });
}

if (violations > 0) {
  console.error(`\nD1-destructive gate FAILED: ${violations} pernyataan DROP TABLE terlarang ditemukan.`);
  process.exit(1);
}

console.log(`D1-destructive gate OK: ${migrationFiles.length} berkas migrasi dipindai, bebas dari DROP TABLE.`);
