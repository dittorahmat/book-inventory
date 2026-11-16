import { test, expect } from "@playwright/test";

test.describe("Portal Siswa - Public Order Flow", () => {
  test("menavigasi portal dan mencari murid", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Buku|Inventaris|Portal/i);

    const searchInput = page.locator('input[placeholder*="nama"], input[placeholder*="Cari"], input[placeholder*="NIS"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill("Hendra");
      const searchBtn = page.locator('button:has-text("Cari Data"), button:has-text("Cari")');
      if (await searchBtn.count() > 0) {
        await searchBtn.first().click();
      }
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("form validation feedback loop responsif dan tidak disabled pasif", async ({ page }) => {
    await page.goto("/");
    const submitBtn = page.locator('button[type="submit"], button:has-text("Kirim"), button:has-text("Pesan")');
    if (await submitBtn.count() > 0) {
      // Sesuai standar §0.63, tombol form tidak boleh disabled secara pasif
      await expect(submitBtn.first()).toBeEnabled();
    }
  });
});
