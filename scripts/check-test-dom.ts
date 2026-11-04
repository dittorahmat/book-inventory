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
    } else if (fullPath.endsWith(".test.tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const testFiles = walk("src");
let violations = 0;

for (const file of testFiles) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  const usesTestingLibrary = content.includes("@testing-library");
  if (usesTestingLibrary) {
    const hasTestDom = lines.some((l) => l.includes("test-dom"));
    if (!hasTestDom) {
      console.error(`Missing test-dom import in component render test: ${file}`);
      violations++;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("from \"@testing-library/react\"") || line.includes("from '@testing-library/react'")) {
        console.error(`Static import of @testing-library/react in ${file}:${i + 1}. Use dynamic 'await import("@testing-library/react")' instead.`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\nTest-DOM gate FAILED: ${violations} pelanggaran ditemukan.`);
  process.exit(1);
} else {
  console.log(`Test-DOM gate OK: ${testFiles.length} file test komponen dipindai, seluruhnya memakai shim test-dom dan dynamic import.`);
}
