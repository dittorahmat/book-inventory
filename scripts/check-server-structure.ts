// Gate struktur file server: memastikan modul layanan (services) diletakkan
// di dalam direktori domain terorganisir (`src/server/services/<domain>/`), bukan
// langsung di root `src/server/*.ts`.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SERVER_ROOT = join(process.cwd(), "src", "server");

// File di root src/server yang diizinkan (entrypoint, utility dasar, seed awal / worker)
const ALLOWED_ROOT_FILES = new Set([
  "auth.ts",
  "auth.test.ts",
  "base64.ts",
  "cleanup-orphan-books.ts",
  "cleanup-orphan-books.test.ts",
  "create-initial-aw1-transfer.ts",
  "create-initial-aw1-transfer.test.ts",
  "e2e-order-supersede.test.ts",
  "extract-aw1-po-allocations.ts",
  "extract-aw1-po-allocations.test.ts",
  "generate-sd-student-orders.ts",
  "generate-sd-student-orders.test.ts",
  "index.ts",
  "index.test.ts",
  "seed-initial-book-stock-service.ts",
  "seed-initial-book-stock.ts",
  "seed-initial-book-stock.test.ts",
  "seed-preschool-packages.ts",
  "seed-preschool-packages.test.ts",
  "seed-suppliers.ts",
  "seed-suppliers.test.ts",
  "seed.ts",
  "sync-book-catalog.ts",
  "sync-book-catalog.test.ts",
  "worker.ts",
]);

const entries = readdirSync(SERVER_ROOT);
const violations: string[] = [];

for (const entry of entries) {
  const fullPath = join(SERVER_ROOT, entry);
  if (statSync(fullPath).isDirectory()) continue;

  if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
    if (!ALLOWED_ROOT_FILES.has(entry)) {
      // Setiap file service / logika bisnis baru wajib di src/server/services/<domain>/
      if (entry.includes("service") || !entry.endsWith(".test.ts")) {
        violations.push(entry);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("\n[GAGAL] File baru terdeteksi langsung di root `src/server/`:");
  for (const v of violations) {
    console.error(`  - src/server/${v}`);
  }
  console.error("\nSesuai konvensi arsitektur (AGENTS.md & CODING_STANDARDS.md):");
  console.error("Modul logika bisnis/layanan wajib diletakkan di `src/server/services/<domain>/`.");
  process.exit(1);
}

console.log("Server-structure gate OK: tidak ada file service baru di root src/server/.");
