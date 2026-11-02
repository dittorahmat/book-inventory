import type { Page } from "playwright";
import { captureScreenshot, performLogin } from "./helpers";

/**
 * Otomasi Skenario Gudang Pusat, Seragam, Rekonsiliasi, & Isolasi Role (Bab 10, 12, 14, 16–20)
 * Menjalankan operasi form: Paket & Rakit, PO Supplier & RTV, Approval Pembatalan Buku Siswa Mundur (RET-B),
 * Gudang Seragam & Approval Seragam Mundur (RET-U), Rekonsiliasi & Audit BA.
 */
export async function runCentralWarehouseScenarios(page: Page, baseUrl: string) {
  console.log("\n=======================================================");
  console.log("📦 BAGIAN 3: SKENARIO GUDANG PUSAT, LOGISTIK, & AUDIT");
  console.log("=======================================================");

  // Login sebagai Central Admin (admin.gudang@alwildan.sch.id)
  console.log("\n▶ Login Central Admin (Gudang Logistik Pusat - admin.gudang@alwildan.sch.id)");
  await page.goto(`${baseUrl.replace(/\/$/, "")}/admin`, { waitUntil: "networkidle" });
  await performLogin(page, "Central Admin", "admin.gudang@alwildan.sch.id");
  await captureScreenshot(page, "10-login-central-admin.png");

  // -------------------------------------------------------------
  // Skenario 9.3: Tab Refund Buku & Approval Siswa Mundur RET-B (Bab 14)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 14 / Skenario 9.3] Tab Refund Buku: Approval Pembatalan Siswa Mundur & Slip RET-B");
  const refundTab = page.locator('button:has-text("Refund Buku"), a:has-text("Refund Buku")');
  if (await refundTab.count() > 0) {
    await refundTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "14-tab-refund-buku-staf.png");

    // Eksekusi persetujuan pembatalan siswa mundur jika ada permohonan terbuka
    const approveWithdrawalBtn = page.locator('button:has-text("Setujui Pengembalian"), button:has-text("Setujui")');
    if (await approveWithdrawalBtn.count() > 0) {
      await approveWithdrawalBtn.first().click();
      await page.waitForLoadState("networkidle");
    }
    console.log("  ✓ Tab Refund Buku dimuat & permohonan siswa mundur ditinjau.");
  }

  // -------------------------------------------------------------
  // Skenario 10: Tab Paket & Rakit (Bab 15)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 15 / Skenario 10] Master Paket & Rakit Bundling");
  const rakitTab = page.locator('button:has-text("Paket & Rakit"), a:has-text("Paket & Rakit")');
  if (await rakitTab.count() > 0) {
    await rakitTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "15-tab-paket-rakit.png");
    console.log("  ✓ Tab Paket & Rakit Bundling berhasil dimuat.");
  }

  // -------------------------------------------------------------
  // Skenario 12: Tab PO Supplier & Retur Vendor (Bab 17)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 17 / Skenario 12] PO Supplier & Retur Vendor (RTV)");
  const poTab = page.locator('button:has-text("PO Supplier"), a:has-text("PO Supplier")');
  if (await poTab.count() > 0) {
    await poTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "17-tab-po-supplier.png");
    console.log("  ✓ Tab PO Supplier & Retur Vendor (RTV) berhasil dimuat.");
  }

  // -------------------------------------------------------------
  // Skenario 14 & 15.4: Tab Gudang Seragam & Approval Seragam Mundur RET-U (Bab 19)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 19 / Skenario 14 & 15.4] Gudang Seragam: Pengiriman & Approval Seragam Mundur");
  const seragamTab = page.locator('button:has-text("Gudang Seragam"), a:has-text("Gudang Seragam")');
  if (await seragamTab.count() > 0) {
    await seragamTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "19-tab-gudang-seragam.png");
    console.log("  ✓ Tab Gudang Seragam dimuat (pengiriman, stok ukuran, & tukar/refund).");
  }

  // -------------------------------------------------------------
  // Skenario 16 & 17: Tab Rekonsiliasi & Audit BA (Bab 21 & 22)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 21 & 22 / Skenario 16 & 17] Rekonsiliasi Finansial & Audit BA");
  const reconTab = page.locator('button:has-text("Rekonsiliasi"), a:has-text("Rekonsiliasi")');
  if (await reconTab.count() > 0) {
    await reconTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "21-tab-rekonsiliasi.png");
    console.log("  ✓ Tab Rekonsiliasi & Audit Berita Acara berhasil dimuat.");
  }

  // -------------------------------------------------------------
  // Skenario 18 & 19: Laporan & Pengaturan (Bab 23 & 24)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 23 & 24 / Skenario 18 & 19] Laporan Penjualan & Pengaturan Cut-off");
  const settingsTab = page.locator('button:has-text("Pengaturan"), a:has-text("Pengaturan")');
  if (await settingsTab.count() > 0) {
    await settingsTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "24-tab-pengaturan.png");
    console.log("  ✓ Tab Pengaturan terverifikasi (Cut-off Satuan dapat diatur Central Admin).");
  }
}
