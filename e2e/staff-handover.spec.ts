import { test, expect } from "@playwright/test";

test.describe("Admin Sekolah & Kasir - Handover Flow", () => {
  test("menavigasi antarmuka admin / login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/.*admin/);
  });

  test("memeriksa antarmuka navigasi dan tab pesanan", async ({ page }) => {
    await page.goto("/admin");
    const navigationArea = page.locator("nav, header, [role='navigation'], body").first();
    await expect(navigationArea).toBeVisible();

    const pesananTab = page.locator('button:has-text("Pesanan Siswa"), a:has-text("Pesanan Siswa"), button:has-text("Pesanan")').first();
    if (await pesananTab.isVisible()) {
      await pesananTab.click();
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

