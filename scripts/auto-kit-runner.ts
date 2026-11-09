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
import { autoKitMaxPackages } from "../src/server/services/stock";

async function main() {
  const args = process.argv.slice(2);
  const schoolArg = args.find((a) => a.startsWith("--school="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");

  let targetSchools: string[] = [];
  if (schoolArg) {
    targetSchools = [schoolArg];
  } else {
    const all = await db.select({ id: schools.id, name: schools.name }).from(schools);
    targetSchools = all.map((s) => s.id);
  }

  console.log(`Menjalankan Auto-Kitting Paket (${dryRun ? "MODE DRY-RUN / SIMULASI" : "MODE MUTASI"}) untuk sekolah: ${targetSchools.join(", ")}...`);

  const summary = await autoKitMaxPackages(db, targetSchools, { dryRun });

  console.log("\n=== Ringkasan Perakitan Paket Otomatis ===");
  if (dryRun) {
    console.log(">> CATATAN: Simulasi berjalan tanpa memutasi database (--dry-run).");
  }
  console.log(`Total Paket Potensial Dirakit : ${summary.totalPackagesAssembled}`);
  console.log(`Total Buku Satuan Diserap     : ${summary.totalBooksConsumed}`);
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
