import { chromium } from "playwright";
import { runPublicPortalScenarios } from "./demo-scenarios/public-portal";
import { runSchoolAdminScenarios } from "./demo-scenarios/school-admin";
import { runCentralWarehouseScenarios } from "./demo-scenarios/central-warehouse";

/**
 * Full End-to-End Demo Automation Suite
 * Menjalankan seluruh bab skenario di DEMO_SCENARIO.md
 */

const BASE_URL = process.env.DEMO_BASE_URL || "https://book-inventory.tech1solusi.workers.dev";
const HEADLESS = process.env.HEADLESS !== "false";

async function main() {
  console.log(`\n=======================================================`);
  console.log(`🎭 MENJALANKAN FULL SUITE OTOMASI DEMO AL WILDAN`);
  console.log(`   Target URL : ${BASE_URL}`);
  console.log(`   Headless   : ${HEADLESS}`);
  console.log(`=======================================================`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  try {
    // 1. Eksekusi Modul Portal Publik (Bab 6–10, 15)
    await runPublicPortalScenarios(page, BASE_URL);

    // 2. Eksekusi Modul Admin Sekolah & Finance (Bab 8, 9, 11, 13)
    await runSchoolAdminScenarios(page, BASE_URL);

    // 3. Eksekusi Modul Gudang Pusat, Seragam, & Audit (Bab 10, 12, 14, 16–20)
    await runCentralWarehouseScenarios(page, BASE_URL);

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
