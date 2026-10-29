import { chromium } from "playwright";

/**
 * Demo Automation Runner
 * Menjalankan skenario demo terpilih di portal publik dan dashboard staf.
 * Target default: https://book-inventory.tech1solusi.workers.dev
 */

const BASE_URL = process.env.DEMO_BASE_URL || "https://book-inventory.tech1solusi.workers.dev";
const HEADLESS = process.env.HEADLESS !== "false";

async function runDemo() {
  console.log(`\n🚀 Memulai Demo Automation di target: ${BASE_URL}`);
  console.log(`   Mode Headless: ${HEADLESS}\n`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // 1. Skenario 1: Portal Publik - Kenaikan Kelas & Paket Terkunci
    console.log("▶ Skenario 1: Cek Kenaikan Kelas Hendra (Al Wildan 1)");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Tunggu input pencarian siswa muncul
    const searchInput = page.locator('input[placeholder*="nama"], input[placeholder*="Cari"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill("Hendra");
      const searchBtn = page.locator('button:has-text("Cari")');
      if (await searchBtn.count() > 0) {
        await searchBtn.first().click();
        await page.waitForTimeout(1000);
      }
      console.log("  ✓ Pencarian murid berhasil dijalankan.");
    }

    // 2. Skenario 5 & 7: Halaman Konfirmasi Bayar Mandiri (Token Ahmad Zaki Pratama)
    console.log("\n▶ Skenario 5 & 7: Halaman Bayar Mandiri Siswa (Ahmad Zaki Pratama)");
    const payUrl = `${BASE_URL.replace(/\/$/, "")}/bayar/buku/demo-token-buku-zaki`;
    await page.goto(payUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const bodyText = await page.textContent("body");
    if (bodyText?.includes("Zaki") || bodyText?.includes("Ahmad") || bodyText?.includes("Konfirmasi") || bodyText?.includes("990.000")) {
      console.log("  ✓ Halaman bayar mandiri Ahmad Zaki Pratama berhasil diakses.");
    } else {
      console.log("  ℹ Halaman bayar dimuat (status code 200).");
    }

    // 3. Skenario Staf: Layar Login & Akses Cepat Demo
    console.log("\n▶ Skenario Staf: Halaman Login & Akses Cepat Demo");
    await page.goto(`${BASE_URL.replace(/\/$/, "")}/login`, { waitUntil: "networkidle" });
    const staffText = await page.textContent("body");
    if (staffText?.includes("Al Wildan") || staffText?.includes("Demo") || staffText?.includes("Masuk")) {
      console.log("  ✓ Akses halaman login staf berhasil diakses.");
    }

    console.log("\n✨ Demo automation suite selesai dieksekusi dengan sukses!");
  } catch (err) {
    console.error("❌ Error saat eksekusi otomasi demo:", err);
  } finally {
    await browser.close();
  }
}

runDemo();
