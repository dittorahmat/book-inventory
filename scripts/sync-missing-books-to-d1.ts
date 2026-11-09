/**
 * scripts/sync-missing-books-to-d1.ts
 *
 * Mengidentifikasi dan mengekspor 325 judul buku yang ada di database lokal
 * tetapi belum ada di Cloudflare D1 Remote (book-inventory-db).
 * Mematuhi §10 Cloudflare D1 Batches:
 * - Chunking maksimal 10 baris per statement INSERT.
 * - File SQL disimpan di data/sql/sync-missing-books.sql.
 */

import { Database } from "bun:sqlite";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { escapeSql } from "./lib/sql-chunk-builder";

export function generateSyncBooksSql(localDbPath = "./data/inventory.db", remoteBookIds?: Set<string>): { sql: string; count: number } {
  const localDb = new Database(localDbPath, { readonly: true });
  const localBooks = localDb.query(`
    SELECT id, isbn, title, author, publisher, publish_year, category, description,
           cover_url, price, buy_price, sell_price, public_title, created_at, updated_at
    FROM books
  `).all() as Array<{
    id: string;
    isbn: string;
    title: string;
    author: string;
    publisher: string;
    publish_year: number | null;
    category: string | null;
    description: string | null;
    cover_url: string | null;
    price: number;
    buy_price: number;
    sell_price: number;
    public_title: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const missingBooks = remoteBookIds ? localBooks.filter((b) => !remoteBookIds.has(b.id)) : localBooks;

  if (missingBooks.length === 0) {
    return { sql: "", count: 0 };
  }

  const statements: string[] = [];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < missingBooks.length; i += CHUNK_SIZE) {
    const chunk = missingBooks.slice(i, i + CHUNK_SIZE);
    const values = chunk
      .map(
        (b) => `(
        ${escapeSql(b.id)},
        ${escapeSql(b.isbn)},
        ${escapeSql(b.title)},
        ${escapeSql(b.author)},
        ${escapeSql(b.publisher)},
        ${escapeSql(b.publish_year)},
        ${escapeSql(b.category)},
        ${escapeSql(b.description)},
        ${escapeSql(b.cover_url)},
        ${escapeSql(b.price)},
        ${escapeSql(b.buy_price)},
        ${escapeSql(b.sell_price)},
        ${escapeSql(b.public_title)},
        ${escapeSql(b.created_at)},
        ${escapeSql(b.updated_at)}
      )`
      )
      .join(",\n");

    statements.push(`INSERT OR IGNORE INTO books (
      id, isbn, title, author, publisher, publish_year, category, description,
      cover_url, price, buy_price, sell_price, public_title, created_at, updated_at
    ) VALUES \n${values};`);
  }

  return { sql: statements.join("\n\n"), count: missingBooks.length };
}

async function main() {
  console.log("Fetching existing book IDs from Cloudflare D1 Remote...");
  const out = execSync('bun run wrangler d1 execute book-inventory-db --remote --command="SELECT id FROM books"', {
    encoding: "utf-8",
  });
  const jsonStart = out.indexOf("[");
  const parsed = JSON.parse(out.slice(jsonStart));
  const remoteIds = new Set(parsed[0].results.map((r: { id: string }) => r.id));

  console.log(`Found ${remoteIds.size} books on remote D1.`);
  const { sql, count } = generateSyncBooksSql("./data/inventory.db", remoteIds);

  if (count === 0) {
    console.log("Remote D1 is already fully up to date with local books.");
    return;
  }

  const outDir = path.resolve("./data/sql");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "sync-missing-books.sql");
  fs.writeFileSync(outPath, sql, "utf-8");
  console.log(`Generated SQL for ${count} missing books -> ${outPath}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Failed to generate sync books SQL:", err);
    process.exit(1);
  });
}
