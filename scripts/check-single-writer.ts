// Gate "satu penulis" untuk tabel yang barisnya tidak boleh dirakit di luar
// modul pemilik (AGENTS.md §0.4/§0.7, CODING_STANDARDS.md §10). Pola ini
// menangkap empat penulis struk dan lima salinan mutasi stok yang pernah
// menyimpang (id alokasi, default bank, 400 vs 409).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface OwnedWrite {
  table: string;
  owner: string;
  pattern: RegExp;
  detail: string;
}

const OWNED_WRITES: OwnedWrite[] = [
  {
    table: "payment_receipts",
    owner: "src/server/services/payment-ledger.ts",
    pattern: /\.insert\s*\(\s*paymentReceipts\s*\)/,
    detail: "pakai receiptWriteQueries() dari services/payment-ledger",
  },
  {
    table: "payment_allocations",
    owner: "src/server/services/payment-ledger.ts",
    pattern: /\.insert\s*\(\s*paymentAllocations\s*\)/,
    detail: "pakai receiptWriteQueries() dari services/payment-ledger",
  },
  {
    table: "uniform_stock",
    owner: "src/server/services/uniform/stock.ts",
    pattern: /\.(insert|update)\s*\(\s*uniformStock\s*\)/,
    detail: "pakai adjustVariantStockQuery()/setVariantStockQuery() dari services/uniform/stock",
  },
  {
    table: "uniform_package_stock",
    owner: "src/server/services/uniform/stock.ts",
    pattern: /\.(insert|update)\s*\(\s*uniformPackageStock\s*\)/,
    detail: "pakai adjustPackageStockQuery() dari services/uniform/stock",
  },
  {
    table: "refund_slips",
    owner: "src/server/services/refund-slip.ts",
    pattern: /\.(insert|update)\s*\(\s*refundSlips\s*\)/,
    detail: "pakai refundSlipInsertQuery()/refundSlipDisbursedQuery() dari services/refund-slip",
  },
  {
    table: "book_returns",
    owner: "src/server/services/return/intake.ts",
    pattern: /\.insert\s*\(\s*bookReturns\s*\)/,
    detail: "satu intake retur: pakai reportReturn() dari services/return (kind defect/withdrawal)",
  },
  {
    table: "uniform_exchanges",
    owner: "src/server/services/uniform/exchange.ts",
    pattern: /\.(insert|update)\s*\(\s*uniformExchanges\s*\)/,
    detail: "satu mesin tukar seragam: pakai requestUniformExchange()/resolveUniformExchange() dari services/uniform/exchange",
  },
];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name)
    ) {
      const normalized = full.replace(/\\/g, "/");
      // Seed baseline mengisi baris awal langsung; itu data, bukan mutasi
      // runtime. Modul demo memakai modul pemilik (payment-ledger/uniform stock).
      if (normalized === "src/server/seed.ts" || normalized.startsWith("src/server/seed-demo/")) continue;
      out.push(normalized);
    }
  }
  return out;
};

const isCommentLine = (line: string): boolean => /^\s*(\/\/|\/\*|\*)/.test(line);

const findings: Array<{ file: string; line: number; table: string; detail: string }> = [];
for (const file of walk("src")) {
  const owned = OWNED_WRITES.filter((rule) => rule.owner !== file);
  if (owned.length === 0) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (isCommentLine(line)) return;
    for (const rule of owned) {
      if (rule.pattern.test(line)) {
        findings.push({ file, line: index + 1, table: rule.table, detail: rule.detail });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("Single-writer gate FAILED — baris tabel dirakit di luar pemiliknya:");
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} [${finding.table}] ${finding.detail}`);
  }
  console.error("Aturan: AGENTS.md §0.4/§0.7, rincian CODING_STANDARDS.md §10.");
  process.exit(1);
}

console.log("Single-writer gate OK: struk, slip retur, retur buku, tukar seragam & stok seragam hanya ditulis modul pemiliknya.");
