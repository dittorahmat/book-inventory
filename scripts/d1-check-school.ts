#!/usr/bin/env bun
/**
 * scripts/d1-check-school.ts
 *
 * Shortcut CLI untuk menginspeksi dan merekap baris data per cabang/lokasi
 * di database Cloudflare D1 Remote (book-inventory-db) secara instan.
 *
 * Penggunaan:
 *   bun scripts/d1-check-school.ts <school-id>
 */

import { execSync } from "node:child_process";

async function main() {
  const schoolId = process.argv[2];
  if (!schoolId) {
    console.error("Penggunaan: bun scripts/d1-check-school.ts <school-id>");
    console.error("Contoh:     bun scripts/d1-check-school.ts school-alw-1");
    process.exit(1);
  }

  console.log(`Memeriksa data di Cloudflare D1 Remote untuk sekolah: ${schoolId}...`);

  const sql = `
    SELECT 'school' as category, count(*) as count FROM schools WHERE id = '${schoolId}'
    UNION ALL
    SELECT 'students', count(*) FROM students WHERE school_id = '${schoolId}'
    UNION ALL
    SELECT 'book_stocks_titles', count(*) FROM book_stocks WHERE school_id = '${schoolId}'
    UNION ALL
    SELECT 'book_stocks_total_qty', COALESCE(sum(available_quantity + reserved_quantity), 0) FROM book_stocks WHERE school_id = '${schoolId}'
    UNION ALL
    SELECT 'package_stocks_types', count(*) FROM package_stocks WHERE school_id = '${schoolId}'
    UNION ALL
    SELECT 'package_stocks_ready_qty', COALESCE(sum(available_quantity), 0) FROM package_stocks WHERE school_id = '${schoolId}';
  `.trim().replace(/\s+/g, " ");

  try {
    const raw = execSync(
      `bun run wrangler d1 execute book-inventory-db --remote --command="${sql}"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
    );

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log(raw);
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const results = parsed[0]?.results || [];

    console.log("\n=== Ringkasan Data Remote D1 ===");
    for (const r of results) {
      console.log(`- ${r.category.padEnd(24)} : ${r.count}`);
    }
  } catch (err: any) {
    console.error("Gagal memeriksa remote D1:", err?.message || err);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
