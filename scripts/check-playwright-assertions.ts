// Gate asersi Playwright deterministik (docs/rules/testing-tooling.md §0.77).
// Dilarang membungkus locator & asersi interaksi di dalam blok `if (await ....count() > 0)`
// atau fallback pasif `expect(body).toBeVisible()`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const norm = (p: string) => p.replace(/\\/g, "/");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.spec\.ts$/.test(entry)) {
      out.push(norm(full));
    }
  }
  return out;
}

const specFiles = walk("e2e");
const violations: string[] = [];

// Pola terlarang anti-tautologi:
// 1. `if (await ...count() > 0)`
// 2. `if (await ...isVisible())`
const FORBIDDEN_PATTERNS = [
  { label: "conditional locator count check (anti-tautology §0.77)", re: /if\s*\(\s*await\s+[^)]+\.count\(\)\s*>\s*0\s*\)/ },
];

for (const file of specFiles) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    for (const { label, re } of FORBIDDEN_PATTERNS) {
      if (re.test(line)) {
        violations.push(`${file}:${index + 1}: ${label}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error("❌ Playwright assertions gate FAILED:");
  violations.forEach((v) => console.error(`  - ${v}`));
  process.exit(1);
} else {
  console.log(`Playwright assertions gate OK: ${specFiles.length} berkas spec bebas dari asersi kondisional tautologis (§0.77).`);
}
