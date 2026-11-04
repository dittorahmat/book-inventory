// Gate integritas pointer aturan dan batas ukuran AGENTS.md (lihat AGENTS.md §0).
// Memastikan AGENTS.md tetap ramping sebagai context pointer (<150 baris),
// dan memastikan seluruh aturan anti-kambuh §0.1 s/d §0.56 tercakup di docs/rules/*.md.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const AGENTS_PATH = join(process.cwd(), "AGENTS.md");
const RULES_DIR = join(process.cwd(), "docs", "rules");
const MAX_AGENTS_LINES = 150;

if (!existsSync(AGENTS_PATH)) {
  console.error("❌ check:rule-pointers: AGENTS.md tidak ditemukan di root proyek.");
  process.exit(1);
}

// 1. Cek batas ukuran AGENTS.md
const agentsContent = readFileSync(AGENTS_PATH, "utf-8");
const agentsLines = agentsContent.split(/\r?\n/).length;

if (agentsLines > MAX_AGENTS_LINES) {
  console.error(
    `❌ check:rule-pointers: AGENTS.md terlalu panjang (${agentsLines} baris > batas ${MAX_AGENTS_LINES} baris).`
  );
  console.error("   Pindahkan detail aturan implementasi ke docs/rules/*.md untuk menjaga context load tetap rendah.");
  process.exit(1);
}

// 2. Cek kelengkapan file modular di docs/rules/
if (!existsSync(RULES_DIR)) {
  console.error("❌ check:rule-pointers: Direktori docs/rules/ tidak ditemukan.");
  process.exit(1);
}

const ruleFiles = readdirSync(RULES_DIR).filter((f) => f.endsWith(".md"));
if (ruleFiles.length === 0) {
  console.error("❌ check:rule-pointers: Tidak ada berkas aturan markdown di docs/rules/.");
  process.exit(1);
}

// Kumpulkan seluruh nomor aturan yang didefinisikan (misal: §0.1, §0.2, ...)
const definedRules = new Map<number, string>();
const rulePattern = /###\s+§0\.(\d+)\b/g;

for (const file of ruleFiles) {
  const filePath = join(RULES_DIR, file);
  const content = readFileSync(filePath, "utf-8");
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(content)) !== null) {
    const ruleNum = parseInt(match[1], 10);
    if (definedRules.has(ruleNum)) {
      console.error(
        `❌ check:rule-pointers: Duplikasi aturan §0.${ruleNum} ditemukan di ${file} dan ${definedRules.get(ruleNum)}.`
      );
      process.exit(1);
    }
    definedRules.set(ruleNum, file);
  }
}

// Pastikan rentang aturan §0.1 s/d §0.56 tercakup lengkap tanpa missing
const missingRules: number[] = [];
for (let i = 1; i <= 56; i++) {
  if (!definedRules.has(i)) {
    missingRules.push(i);
  }
}

if (missingRules.length > 0) {
  console.error(
    `❌ check:rule-pointers: Aturan berikut hilang atau belum didefinisikan di docs/rules/*.md: ${missingRules.map((n) => `§0.${n}`).join(", ")}`
  );
  process.exit(1);
}

console.log(
  `Rule-pointers gate OK: AGENTS.md ramping (${agentsLines}/${MAX_AGENTS_LINES} baris), 56 aturan anti-kambuh terdefinisi lengkap di docs/rules/ (${ruleFiles.length} berkas).`
);
