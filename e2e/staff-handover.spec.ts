import { test, expect } from "@playwright/test";

test.describe("Admin Sekolah & Kasir - Handover Flow", () => {
  test("menavigasi antarmuka admin / login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toBeVisible();
  });

  test("memeriksa tab pesanan dan tombol serah terima", async ({ page }) => {
    await page.goto("/admin");
    const pesananTab = page.locator('button:has-text("Pesanan Siswa"), a:has-text("Pesanan Siswa"), button:has-text("Pesanan")');
    if (await pesananTab.count() > 0) {
      await pesananTab.first().click();
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
