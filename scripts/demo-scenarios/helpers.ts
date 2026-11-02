import type { BrowserContext, Page } from "playwright";
import { mkdirSync } from "node:fs";

export async function captureScreenshot(page: Page, filename: string): Promise<void> {
  const screenshotDir = "test-results/demo-screenshots";
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: `${screenshotDir}/${filename}`, fullPage: false });
}

export interface InterceptedError {
  type: "http" | "js";
  status?: number;
  url?: string;
  message: string;
}

/**
 * Pasang fail-fast error listener pada Page atau BrowserContext.
 * Menghentikan eksekusi (fail-fast) dan mencatat error terstruktur bila terjadi HTTP >= 500 atau unhandled crash.
 */
export function attachErrorFailFast(
  target: Page | BrowserContext,
  errorSink?: InterceptedError[],
  options: { immediateThrow?: boolean } = { immediateThrow: true }
): void {
  const handleResponse = (res: { status: () => number; url: () => string }) => {
    if (res.status() >= 500) {
      const errLine = `[HTTP ${res.status()}] ${res.url()}`;
      console.error(`  🚨 Terdeteksi respon kegagalan server: ${errLine}`);
      const errObj: InterceptedError = {
        type: "http",
        status: res.status(),
        url: res.url(),
        message: errLine,
      };
      if (errorSink) errorSink.push(errObj);
      if (options.immediateThrow) {
        throw new Error(`Fail-Fast Terpicu: Respons server error ${errLine}`);
      }
    }
  };

  const handlePageError = (err: Error) => {
    console.error(`  🚨 Terdeteksi unhandled JavaScript error pada halaman: ${err.message}`);
    const errObj: InterceptedError = {
      type: "js",
      message: err.message,
    };
    if (errorSink) errorSink.push(errObj);
    if (options.immediateThrow) {
      throw new Error(`Fail-Fast Terpicu: Unhandled page crash: ${err.message}`);
    }
  };

  if ("on" in target) {
    if ("pages" in target) {
      // BrowserContext: pantau seluruh page aktif dan page baru (tabs/popups)
      const context = target as BrowserContext;
      context.on("page", (newPage) => {
        newPage.on("response", handleResponse);
        newPage.on("pageerror", handlePageError);
      });
      for (const p of context.pages()) {
        p.on("response", handleResponse);
        p.on("pageerror", handlePageError);
      }
    } else {
      // Page tunggal
      const page = target as Page;
      page.on("response", handleResponse);
      page.on("pageerror", handlePageError);
    }
  }
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
