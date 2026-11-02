import type { Page } from "playwright";
import { mkdirSync } from "node:fs";

/** 1x1 transparent PNG data-URL untuk mock upload formulir dokumen browser */
export const DUMMY_PROOF_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export async function captureScreenshot(page: Page, filename: string): Promise<void> {
  const screenshotDir = "test-results/demo-screenshots";
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: `${screenshotDir}/${filename}`, fullPage: false });
}

/**
 * Login dan eksekusi seed database demo melalui UI/session Playwright.
 */
export async function resetDemoDatabaseViaBrowser(page: Page, baseUrl: string): Promise<void> {
  try {
    await page.goto(`${baseUrl.replace(/\/$/, "")}/admin`, { waitUntil: "networkidle" });
    await performLogin(page, "Central Admin", "admin.gudang@alwildan.sch.id");
    const seedRes = await page.request.post(`${baseUrl.replace(/\/$/, "")}/api/demo/seed`);
    if (seedRes.status() === 200) {
      console.log("  ✓ Database berhasil di-seed ulang via sesi Central Admin terotentikasi.");
    }
  } catch (err) {
    console.log("  ℹ Reset demo seed lewat sesi browser dilewati:", err instanceof Error ? err.message : String(err));
  }
}
export async function performLogin(page: Page, roleLabel: string, email: string): Promise<void> {
  // Cek apakah ada session aktif sebelumnya, lakukan logout jika ada tombol Sign Out
  const signOutBtn = page.locator('button[title*="Sign Out"], button:has-text("Keluar")');
  if (await signOutBtn.count() > 0) {
    await signOutBtn.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
  }

  // Jika masih di portal publik, klik tautan/tombol Login Staf jika ada
  const staffLink = page.locator('button:has-text("Login Staf"), a:has-text("Login Staf"), button:has-text("Portal Staf")');
  if (await staffLink.count() > 0) {
    await staffLink.first().click();
    await page.waitForLoadState("domcontentloaded");
  }

  // Cek tombol akses cepat demo
  const quickBtn = page.locator(`button:has-text("${roleLabel}")`);
  if (await quickBtn.count() > 0) {
    await quickBtn.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    return;
  }
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const pwdInput = page.locator('input[type="password"], input[name="password"]');
  if (await emailInput.count() > 0 && await pwdInput.count() > 0) {
    await emailInput.first().fill(email);
    await pwdInput.first().fill("password123");
    const submitBtn = page.locator('button[type="submit"], button:has-text("Masuk")');
    await submitBtn.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }
}
