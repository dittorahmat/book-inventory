import fs from "node:fs";
import path from "node:path";

function walk(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        walk(fullPath, fileList);
      }
    } else if (fullPath.endsWith(".ts") && (fullPath.includes("parser") || fullPath.includes("import"))) {
      if (!fullPath.endsWith(".test.ts") && !fullPath.endsWith(".test.tsx")) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const parserFiles = walk("src");
let violations = 0;

for (const file of parserFiles) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Cegah pencocokan substring header pendek: includes("wa"), includes("hp"), includes("id") pada variabel header
    const match = line.match(/\.includes\(["']([a-zA-Z0-9_-]{1,2})["']\)/);
    if (match && (line.includes("header") || line.includes("h.") || line.includes("(h)") || line.includes("row"))) {
      console.error(
        `Short substring collision danger in ${file}:${i + 1} -> .includes("${match[1]}"). Use explicit exact equality (=== "${match[1]}") per §0.79.`
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\nParser-token gate FAILED: ${violations} pelanggaran ditemukan.`);
  process.exit(1);
} else {
  console.log(`Parser-token gate OK: ${parserFiles.length} file parser dipindai, bebas dari heuristik substring pendek.`);
}
