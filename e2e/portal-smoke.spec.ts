import { test, expect } from "@playwright/test";

test.describe("Portal Siswa - Public Order Flow", () => {
  test("menavigasi portal dan mencari murid secara deterministik", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Buku|Inventaris|Portal/i);

    const searchInput = page.locator('input[placeholder*="nama"], input[placeholder*="Cari"], input[placeholder*="NIS"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Hendra");

    const searchBtn = page.locator('button:has-text("Cari Data"), button:has-text("Cari")').first();
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    // Verifikasi hasil pencarian Hendra Wahyudi tampil di kartu / dropdown
    await expect(page.locator("body")).toContainText(/Hendra/i);
  });

  test("form validation feedback loop responsif dan tidak disabled pasif", async ({ page }) => {
    await page.goto("/");
    const submitBtn = page.locator('button[type="submit"], button:has-text("Kirim"), button:has-text("Pesan"), button:has-text("Cari Data"), button:has-text("Cari")').first();
    await expect(submitBtn).toBeVisible();
    // Sesuai standar §0.63, tombol formulir interaktif dan dilarang disabled secara pasif
    await expect(submitBtn).toBeEnabled();
  });
});

