// Memeriksa bahwa pemanggilan asynchronous fetch di komponen portal publik
// tidak menggunakan silent-catch (.catch(() => {})) tanpa penanganan error pengguna,
// sesuai Mandat Anti-Kambuh AGENTS.md §0.31.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SILENT_CATCH_PATTERN = /\.catch\(\s*(\(\s*\)|\w+)?\s*=>\s*(\{\s*\}|undefined|null)\s*\)/;

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

const files = walk(join(process.cwd(), "src", "components", "portal"));

const violations: Array<{ file: string; line: number; match: string }> = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    const match = lineText.match(SILENT_CATCH_PATTERN);
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
  console.error("No-silent-catch gate GAGAL: Ditemukan silent-catch pada pemanggilan klien portal:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.match}`);
  }
  console.error("\nMandat AGENTS.md §0.31: Dilarang silent-catch (.catch(() => {})), tampilkan pesan kegagalan ramah pengguna.");
  process.exit(1);
}

console.log("No-silent-catch gate OK: tidak ada silent-catch pada fetch portal.");
