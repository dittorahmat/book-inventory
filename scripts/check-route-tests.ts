// Route-test pairing gate: gagalkan (exit 1) jika ada route di
// src/server/routes/*.ts tanpa pasangan *.test.ts. Mengunci AGENTS.md
// aturan 5 (setiap endpoint mutasi wajib punya test + regression test
// tiap bug) — preseden: direct-sales.ts tanpa test menyembunyikan bug
// studentId null yang membuat endpoint selalu 500. Dijalankan via
// `bun run check:route-tests` dan di CI (lihat .github/workflows/checks.yml).
import { readdirSync } from "node:fs";

const ROUTES_DIR = "src/server/routes";
const EXCLUDE = new Set(["test-actor.ts"]);

const entries = new Set(readdirSync(ROUTES_DIR));
const offenders = [...entries]
  .filter((e) => /\.ts$/.test(e) && !/\.test\.ts$/.test(e) && !EXCLUDE.has(e))
  .filter((e) => !entries.has(e.replace(/\.ts$/, ".test.ts")))
  .sort();

if (offenders.length > 0) {
  console.error("Route-test gate FAILED — route tanpa pasangan test:");
  for (const o of offenders) console.error(`  ${ROUTES_DIR}/${o}  →  ${o.replace(/\.ts$/, ".test.ts")}`);
  console.error("WAJIB tambah suite di src/server/routes/*.test.ts (AGENTS.md aturan 5).");
  process.exit(1);
}

console.log(`Route-test gate OK: semua route di ${ROUTES_DIR}/ punya pasangan test.`);
