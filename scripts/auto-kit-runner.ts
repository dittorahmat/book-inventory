#!/usr/bin/env bun
/**
 * scripts/auto-kit-runner.ts
 *
 * Runner CLI untuk merakit (kitting) paket buku secara otomatis
 * dari saldo stok buku satuan (`book_stocks`) ke `package_stocks`
 * berdasarkan Bill of Materials (`book_package_items`).
 *
 * Penggunaan:
 *   bun scripts/auto-kit-runner.ts [--school=school-id] [--dry-run]
 */

import { db } from "../src/db";
import { schools } from "../src/db/schema";
import { autoKitMaxPackages } from "../src/server/auto-kit-service";

async function main() {
  const args = process.argv.slice(2);
  const schoolArg = args.find((a) => a.startsWith("--school="))?.split("=")[1];

  let targetSchools: string[] = [];
  if (schoolArg) {
    targetSchools = [schoolArg];
  } else {
    const all = await db.select({ id: schools.id, name: schools.name }).from(schools);
    targetSchools = all.map((s) => s.id);
  }

  console.log(`Menjalankan Auto-Kitting Paket untuk sekolah: ${targetSchools.join(", ")}...`);

  const summary = await autoKitMaxPackages(db, targetSchools);

  console.log("\n=== Ringkasan Perakitan Paket Otomatis ===");
  console.log(`Total Paket Dirakit : ${summary.totalPackagesAssembled}`);
  console.log(`Total Buku Dipotong : ${summary.totalBooksConsumed}`);
  console.log("\nRincian Paket per Lokasi:");
  for (const item of summary.assembledPackages) {
    console.log(`- [${item.schoolId}] ${item.packageName}: +${item.quantityAssembled} paket`);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Gagal menjalankan auto-kitting:", err);
    process.exit(1);
  });
}
