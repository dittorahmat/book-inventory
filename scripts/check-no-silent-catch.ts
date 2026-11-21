// Memeriksa bahwa pemanggilan asynchronous fetch di komponen portal publik,
// views, dan komponen staf tidak menggunakan silent-catch (.catch(() => {}))
// tanpa penanganan error pengguna, sesuai Mandat Anti-Kambuh docs/rules/portal-client.md §0.46 (ADR-0019/§0.31).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SILENT_PROMISE_CATCH_PATTERN = /\.catch\(\s*(\(\s*\)|\w+)?\s*=>\s*(\{\s*\}|undefined|null)\s*\)/;
const EMPTY_BLOCK_CATCH_PATTERN = /catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*\}/;

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

const targetDirs = [
  join(process.cwd(), "src", "components"),
  join(process.cwd(), "src", "views"),
];

const files = targetDirs.flatMap((dir) => walk(dir));

const violations: Array<{ file: string; line: number; match: string }> = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    // Abaikan operasi clipboard browser opsional
    if (lineText.includes("clipboard.writeText")) return;

    const matchPromise = lineText.match(SILENT_PROMISE_CATCH_PATTERN);
    if (matchPromise) {
      violations.push({
        file: file.replace(/\\/g, "/"),
        line: idx + 1,
        match: matchPromise[0],
      });
    }
  });

  // Periksa try-catch block kosong (multi-line atau single-line)
  const blockMatches = content.matchAll(new RegExp(EMPTY_BLOCK_CATCH_PATTERN, "g"));
  for (const m of blockMatches) {
    if (m.index !== undefined) {
      const lineNum = content.slice(0, m.index).split(/\r?\n/).length;
      violations.push({
        file: file.replace(/\\/g, "/"),
        line: lineNum,
        match: m[0].replace(/\s+/g, " ").slice(0, 50),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("No-silent-catch gate GAGAL: Ditemukan silent-catch pada pemanggilan klien:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.match}`);
  }
  console.error("\nMandat docs/rules/portal-client.md §0.46: Dilarang silent-catch (.catch(() => {})), tampilkan pesan kegagalan ramah pengguna.");
  process.exit(1);
}

console.log("No-silent-catch gate OK: tidak ada silent-catch pada fetch UI components dan views.");
