/**
 * scripts/sync-missing-transfer-items-to-d1.ts
 *
 * Mengidentifikasi dan mengekspor 182 baris transfer_shipment_items yang ada di local
 * tetapi belum ada di Cloudflare D1 Remote.
 * Menggunakan chunking 10 baris per statement sesuai §10.
 */

import { Database } from "bun:sqlite";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { escapeSql } from "./lib/sql-chunk-builder";

export function generateSyncTransferItemsSql(
  localDbPath = "./data/inventory.db",
  remoteItemIds?: Set<string>
): { sql: string; count: number } {
  const localDb = new Database(localDbPath, { readonly: true });
  const localItems = localDb.query(`
    SELECT id, shipment_id, item_type, book_id, quantity, unit_price_snapshot, received_condition, created_at
    FROM transfer_shipment_items
    WHERE shipment_id = 'trf-aw1-2026-initial'
  `).all() as Array<{
    id: string;
    shipment_id: string;
    item_type: string;
    book_id: string;
    quantity: number;
    unit_price_snapshot: number;
    received_condition: string;
    created_at: string;
  }>;

  const missing = remoteItemIds ? localItems.filter((i) => !remoteItemIds.has(i.id)) : localItems;

  if (missing.length === 0) {
    return { sql: "", count: 0 };
  }

  const statements: string[] = [];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const chunk = missing.slice(i, i + CHUNK_SIZE);
    const values = chunk
      .map(
        (item) => `(
        ${escapeSql(item.id)},
        ${escapeSql(item.shipment_id)},
        ${escapeSql(item.item_type)},
        ${escapeSql(item.book_id)},
        ${escapeSql(item.quantity)},
        ${escapeSql(item.unit_price_snapshot)},
        ${escapeSql(item.received_condition)},
        ${escapeSql(item.created_at)}
      )`
      )
      .join(",\n");

    statements.push(`INSERT OR IGNORE INTO transfer_shipment_items (
      id, shipment_id, item_type, book_id, quantity, unit_price_snapshot, received_condition, created_at
    ) VALUES \n${values};`);
  }

  return { sql: statements.join("\n\n"), count: missing.length };
}

async function main() {
  console.log("Fetching existing transfer item IDs from Cloudflare D1 Remote...");
  const out = execSync(
    'bun run wrangler d1 execute book-inventory-db --remote --command="SELECT id FROM transfer_shipment_items WHERE shipment_id = \'trf-aw1-2026-initial\'"',
    { encoding: "utf-8" }
  );
  const jsonStart = out.indexOf("[");
  const remoteIds = new Set(JSON.parse(out.slice(jsonStart))[0].results.map((r: { id: string }) => r.id));

  console.log(`Found ${remoteIds.size} transfer items on remote D1.`);
  const { sql, count } = generateSyncTransferItemsSql("./data/inventory.db", remoteIds);

  if (count === 0) {
    console.log("Remote D1 is already fully up to date with transfer shipment items.");
    return;
  }

  const outDir = path.resolve("./data/sql");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "sync-missing-transfer-items.sql");
  fs.writeFileSync(outPath, sql, "utf-8");
  console.log(`Generated SQL for ${count} missing transfer items -> ${outPath}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Failed to generate transfer items sync SQL:", err);
    process.exit(1);
  });
}
