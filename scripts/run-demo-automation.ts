import { chromium } from "playwright";
import { runPublicPortalScenarios } from "./demo-scenarios/public-portal";
import { runSchoolAdminScenarios } from "./demo-scenarios/school-admin";
import { runCentralWarehouseScenarios } from "./demo-scenarios/central-warehouse";

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

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  try {
    // 0. Auto-seed database lokal bila tersedia endpoint /api/demo/seed
    try {
      const seedRes = await fetch(`${BASE_URL}/api/demo/seed`, { method: "POST" });
      if (seedRes.ok) {
        console.log("  ✓ Database berhasil di-reset & di-seed untuk demo.");
      }
    } catch {
      console.log("  ℹ Target server running without direct auto-seed hook (continuing).");
    }

    // 1. Eksekusi Modul Portal Publik (Bab 6–10, 15)
    await runPublicPortalScenarios(page, BASE_URL);

    // 2. Eksekusi Modul Central Admin (Gudang Logistik Pusat) - Master Akun Demo (§2, §3 di DEMO_SCENARIO.md)
    await runCentralWarehouseScenarios(page, BASE_URL);

    // 3. Eksekusi Modul Admin Sekolah & Finance (Al Wildan 1)
    await runSchoolAdminScenarios(page, BASE_URL);

    console.log("\n=======================================================");
    console.log("🎉 SELURUH SKENARIO DEMO E2E BERHASIL DIEKSEKUSI PENUH!");
    console.log("=======================================================\n");
  } catch (error) {
    console.error("\n❌ Terjadi kegagalan pada saat eksekusi otomasi demo:", error);
  } finally {
    await browser.close();
  }
}

main();
