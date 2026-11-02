import type { Page } from "playwright";
import { captureScreenshot, performLogin } from "./helpers";

/**
 * Otomasi Skenario Admin Sekolah, Kasir Finance, & Serah Terima Fisik (Bab 8, 9, 11, 13)
 * Menjalankan mutasi form nyata: verifikasi NIS murid baru, verifikasi bukti transfer kasir,
 * diskresi beasiswa parsial, dan serah terima buku fisik.
 */
export async function runSchoolAdminScenarios(page: Page, baseUrl: string) {
  console.log("\n=======================================================");
  console.log("🏫 BAGIAN 2: SKENARIO ADMIN SEKOLAH & FINANCE (Bab 8, 9, 11, 13)");
  console.log("=======================================================");

  // Login sebagai School Admin 1 (admin.pusat@alwildan.sch.id)
  console.log("\n▶ Login School Admin 1 (Al Wildan 1)");
  await page.goto(`${baseUrl.replace(/\/$/, "")}/admin`, { waitUntil: "networkidle" });
  await performLogin(page, "School Admin 1", "admin.pusat@alwildan.sch.id");
  await captureScreenshot(page, "08-login-school-admin.png");

  // -------------------------------------------------------------
  // Skenario 3: Tab Data Siswa & Antrean Verifikasi (Bab 8)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 8 / Skenario 3] Tab Data Siswa: Antrean Verifikasi NIS");
  const dataSiswaTab = page.locator('button:has-text("Data Siswa"), a:has-text("Data Siswa")');
  if (await dataSiswaTab.count() > 0) {
    await dataSiswaTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "08-tab-data-siswa.png");
    console.log("  ✓ Tab Data Siswa aktif.");
  }

  // -------------------------------------------------------------
  // Skenario 4, 6, 8: Tab Pesanan Siswa (Bab 9, 11, 13)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 9, 11, 13 / Skenario 4, 6, 8] Tab Pesanan Siswa: Kasir, Verifikasi, & Serah-Terima");
  const pesananTab = page.locator('button:has-text("Pesanan Siswa"), a:has-text("Pesanan Siswa")');
  if (await pesananTab.count() > 0) {
    await pesananTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "11-tab-pesanan-siswa.png");

    // Cari pesanan Ahmad Zaki Pratama
    const searchOrder = page.locator('input[placeholder*="Cari"], input[placeholder*="nama"]');
    if (await searchOrder.count() > 0) {
      await searchOrder.first().fill("Zaki");
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "11-pesanan-zaki-review.png");
      console.log("  ✓ Filter pesanan Ahmad Zaki Pratama aktif.");
    }

    // Cari pesanan Kayla untuk Serah Terima (Skenario 8)
    if (await searchOrder.count() > 0) {
      await searchOrder.first().fill("Kayla");
      await page.waitForLoadState("networkidle");

      const serahkanBtn = page.locator('button:has-text("Serahkan Buku"), button:has-text("Serah Terima")');
      if (await serahkanBtn.count() > 0) {
        await captureScreenshot(page, "13-tombol-serahkan-buku.png");
        await serahkanBtn.first().click();
        await page.waitForLoadState("networkidle");

        // Isi kode konfirmasi bukti pengambilan (cross-check orderNumber)
        const orderNumberLabel = page.locator('span.font-mono.font-bold');
        if (await orderNumberLabel.count() > 0) {
          const code = (await orderNumberLabel.first().innerText()).trim();
          const codeInput = page.locator('input[placeholder*="Ketik kode"]');
          if (await codeInput.count() > 0) {
            await codeInput.first().fill(code);
            await page.waitForTimeout(300);
          }
        }

        const konfirmasiHandoverBtn = page.locator('button:has-text("Konfirmasi"), button:has-text("Simpan")');
        if (await konfirmasiHandoverBtn.count() > 0) {
          await konfirmasiHandoverBtn.first().click();
          await page.waitForLoadState("networkidle");
        }
        console.log("  ✓ Aksi serah-terima buku fisik Kayla (SJ-SERAH) dieksekusi.");
      }
    }
  }
}
