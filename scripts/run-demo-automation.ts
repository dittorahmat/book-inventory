import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { runPublicPortalScenarios } from "./demo-scenarios/public-portal";
import { runSchoolAdminScenarios } from "./demo-scenarios/school-admin";
import { runCentralWarehouseScenarios } from "./demo-scenarios/central-warehouse";
import { resetDemoDatabaseViaBrowser, attachErrorFailFast, type InterceptedError } from "./demo-scenarios/helpers";

/**
 * Full End-to-End Demo Automation Suite
 * Menjalankan seluruh bab skenario di DEMO_SCENARIO.md
 */

const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3000";
// Default headless bila di CI, default headed bila dijalankan lokal untuk presentasi visual
const HEADLESS = process.env.HEADLESS === "true" || process.env.CI === "true";
const SLOW_MO = Number(process.env.SLOW_MO ?? (HEADLESS ? 0 : 300));

async function main() {
  console.log(`\n=======================================================`);
  console.log(`🎭 MENJALANKAN FULL SUITE OTOMASI DEMO AL WILDAN`);
  console.log(`   Target URL : ${BASE_URL}`);
  console.log(`   Headless   : ${HEADLESS} (Browser ${HEADLESS ? "sembunyi" : "terbuka di layar"})`);
  console.log(`   SlowMo     : ${SLOW_MO}ms per aksi (kecepatan presentasi)`);
  console.log(`=======================================================`);

  // Pre-flight check: Pastikan migrasi skema SQLite lokal tersinkronisasi penuh
  try {
    console.log("⚙ Memeriksa dan mensinkronkan skema database lokal...");
    execSync("bun run db:push:bun --all", { stdio: "inherit" });
    console.log("  ✓ Skema database lokal terverifikasi mutakhir.");
  } catch (err) {
    console.error("  ❌ Sinkronisasi skema lokal gagal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  const failedResponses: InterceptedError[] = [];
  // Pasang fail-fast listener di tingkat BrowserContext agar mencakup seluruh tab/popup
  attachErrorFailFast(context, failedResponses, { immediateThrow: true });

  try {
    // 0. Auto-seed database lokal dengan autentikasi browser session
    await resetDemoDatabaseViaBrowser(page, BASE_URL);

    // 1. Eksekusi Modul Portal Publik (Bab 6–10, 15)
    await runPublicPortalScenarios(page, BASE_URL);

    // 2. Eksekusi Modul Central Admin (Gudang Logistik Pusat) - Master Akun Demo (§2, §3 di DEMO_SCENARIO.md)
    await runCentralWarehouseScenarios(page, BASE_URL);

    // 3. Eksekusi Modul Admin Sekolah & Finance (Al Wildan 1)
    await runSchoolAdminScenarios(page, BASE_URL);

    // Verifikasi bahwa selama otomasi demo tidak terjadi kegagalan server HTTP 500 / JS Crash
    if (failedResponses.length > 0) {
      throw new Error(`Terdeteksi ${failedResponses.length} kegagalan server selama otomasi:\n${failedResponses.map((f) => f.message).join("\n")}`);
    }

    console.log("\n=======================================================");
    console.log("🎉 SELURUH SKENARIO DEMO E2E BERHASIL DIEKSEKUSI PENUH!");
    console.log("=======================================================\n");
  } catch (error) {
    console.error("\n❌ Terjadi kegagalan pada saat eksekusi otomasi demo:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
