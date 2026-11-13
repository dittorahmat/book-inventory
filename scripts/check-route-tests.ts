// Route-test pairing gate: gagalkan (exit 1) jika ada route di
// src/server/routes/*.ts tanpa pasangan *.test.ts, atau jika file route
// diubah pada commit/staged tanpa disertai perubahan pada file *.test.ts pasangannya.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROUTES_DIR = "src/server/routes";
const EXCLUDE = new Set(["test-actor.ts"]);

const isRouterModule = (file: string): boolean =>
  /new Hono\s*\(/.test(readFileSync(join(ROUTES_DIR, file), "utf8"));

const entries = new Set(readdirSync(ROUTES_DIR));
const offenders = [...entries]
  .filter((e) => /\.ts$/.test(e) && !/\.test\.ts$/.test(e) && !EXCLUDE.has(e))
  .filter((e) => isRouterModule(e))
  .filter((e) => !entries.has(e.replace(/\.ts$/, ".test.ts")))
  .sort();

if (offenders.length > 0) {
  console.error("Route-test gate FAILED — route tanpa pasangan test:");
  for (const o of offenders) console.error(`  ${ROUTES_DIR}/${o}  →  ${o.replace(/\.ts$/, ".test.ts")}`);
  console.error("WAJIB tambah suite di src/server/routes/*.test.ts (AGENTS.md aturan 5).");
  process.exit(1);
}

// Pemeriksaan modifikasi: jika route *.ts dimodifikasi pada staged/working tree,
// file *.test.ts pasangannya wajib ikut dimodifikasi (AGENTS.md §1.5).
const isCheckDiff = process.argv.includes("--diff") || process.env.CHECK_DIFF === "1";
if (isCheckDiff) {
  try {
    const statusOut = execSync("git status --porcelain", { encoding: "utf8" });
    const changedFiles = new Set(
      statusOut
        .split("\n")
        .map((line) => line.trim().split(/\s+/)[1])
        .filter(Boolean)
    );
    const uncompanionRoutes: string[] = [];
    for (const file of changedFiles) {
      if (file.startsWith(`${ROUTES_DIR}/`) && file.endsWith(".ts") && !file.endsWith(".test.ts")) {
        const testFile = file.replace(/\.ts$/, ".test.ts");
        if (!changedFiles.has(testFile) && entries.has(file.replace(`${ROUTES_DIR}/`, "").replace(/\.ts$/, ".test.ts"))) {
          uncompanionRoutes.push(file);
        }
      }
    }
    if (uncompanionRoutes.length > 0) {
      console.error("Route-test gate FAILED — file route berubah tanpa modifikasi test skenario pendamping:");
      for (const u of uncompanionRoutes) {
        const testPath = u.replace(/\.ts$/, ".test.ts");
        console.error(`  ${u} (WAJIB sertakan skenario regression test di ${testPath})`);
        console.error(`  Tips verifikasi cepat: bun test ${testPath}`);
      }
      console.error("Setiap perubahan perilaku atau bug-fix pada file route wajib menambah skenario di *.test.ts (AGENTS.md §1.5).");
      process.exit(1);
    }
  } catch {
    // Non-fatal bila git status tidak tersedia
  }
}

console.log(`Route-test gate OK: semua route di ${ROUTES_DIR}/ punya pasangan test.`);
