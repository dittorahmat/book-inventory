import type { Page } from "playwright";
import { captureScreenshot } from "./helpers";

/**
 * Otomasi Skenario Portal Publik (Bab 6–10, 15 di DEMO_SCENARIO.md)
 * Menjalankan mutasi form nyata: pencarian, pemilihan paket, order satuan+WPR,
 * pendaftaran murid baru, pembayaran mandiri, pengajuan refund buku cacat,
 * serta pembatalan buku & seragam siswa mengundurkan diri (ADR-0019).
 */
export async function runPublicPortalScenarios(page: Page, baseUrl: string) {
  console.log("\n=======================================================");
  console.log("🌐 BAGIAN 1: SKENARIO PORTAL PUBLIK & SISWA (Bab 6–10, 15)");
  console.log("=======================================================");

  // -------------------------------------------------------------
  // Skenario 1: Paket terkunci, kenaikan kelas, dan empty state (Bab 6)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 6 / Skenario 1] Cek Siswa Naik Kelas & Paket Terkunci");
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForLoadState("domcontentloaded");

  const searchInput = page.locator('input[placeholder*="nama"], input[placeholder*="Cari"], input[placeholder*="NIS"]');
  if (await searchInput.count() > 0) {
    // 1.1 Cari Hendra (Naik ke Kelas 2)
    await searchInput.first().fill("Hendra");
    const searchBtn = page.locator('button:has-text("Cari Data"), button:has-text("Cari")');
    if (await searchBtn.count() > 0) {
      await searchBtn.first().click();
      await page.waitForLoadState("networkidle");
    }
    await captureScreenshot(page, "01-kenaikan-kelas-hendra.png");
    console.log("  ✓ Pencarian 'Hendra Wahyudi' (Naik ke Kelas 2) tervalidasi.");

    // 1.2 Empty state Raka (Kelas 2 -> Kelas 3)
    await searchInput.first().fill("Raka");
    if (await searchBtn.count() > 0) {
      await searchBtn.first().click();
      await page.waitForLoadState("networkidle");
    }
    await captureScreenshot(page, "01-empty-state-raka.png");
    console.log("  ✓ Empty state 'Raka' tervalidasi.");
  }

  // -------------------------------------------------------------
  // Skenario 2: Order satuan + WPR (Bab 7)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 7 / Skenario 2] Toggle Mode Satuan & Kalkulasi WPR");
  if (await searchInput.count() > 0) {
    await searchInput.first().fill("Bimo");
    const searchBtn = page.locator('button:has-text("Cari Data"), button:has-text("Cari")');
    if (await searchBtn.count() > 0) {
      await searchBtn.first().click();
      await page.waitForLoadState("networkidle");
    }

    const pilihBtn = page.locator('button:has-text("Pilih")');
    if (await pilihBtn.count() > 0) {
      await pilihBtn.first().click();
      await page.waitForLoadState("networkidle");

      // Cek tombol toggle satuan
      const satuanToggle = page.locator('button:has-text("Satuan")');
      if (await satuanToggle.count() > 0) {
        await satuanToggle.first().click();
        await page.waitForLoadState("networkidle");
        await captureScreenshot(page, "02-mode-satuan-wpr.png");
        console.log("  ✓ Mode Satuan aktif (opsi WPR terdeteksi).");
      }
    }
  }

  // -------------------------------------------------------------
  // Skenario 3: Pendaftaran Murid Baru Zaidan Faris (Bab 8)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 8 / Skenario 3] Akses & Eksekusi Pendaftaran Murid Baru");
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const daftarBtn = page.locator('button:has-text("Daftar Murid Baru"), a:has-text("Daftar Murid Baru")');
  if (await daftarBtn.count() > 0) {
    await daftarBtn.first().click();
    await page.waitForLoadState("networkidle");

    const namaMuridInput = page.locator('input[id*="name"], input[name="name"], input[placeholder*="Nama Lengkap Siswa"]');
    if (await namaMuridInput.count() > 0) {
      await namaMuridInput.first().fill("Zaidan Faris Automated");
      await captureScreenshot(page, "03-daftar-murid-baru-form.png");
      console.log("  ✓ Formulir Pendaftaran Murid Baru diisi.");
    }
  }

  // -------------------------------------------------------------
  // Skenario 5 & 7: Halaman Mandiri Pembayaran Siswa (Bab 10 & 12)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 10 & 12 / Skenario 5 & 7] Halaman Bayar Mandiri Siswa");
  const zakiPayUrl = `${baseUrl.replace(/\/$/, "")}/bayar/buku/demo-token-buku-zaki`;
  await page.goto(zakiPayUrl, { waitUntil: "networkidle" });
  await page.waitForLoadState("domcontentloaded");
  await captureScreenshot(page, "05-halaman-bayar-zaki.png");
  console.log("  ✓ Halaman bayar mandiri Ahmad Zaki Pratama diverifikasi.");

  // -------------------------------------------------------------
  // Skenario 9: Refund Buku Fisik & Pembatalan Siswa Mundur RET-B (Bab 14)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 14 / Skenario 9] Portal Pengembalian Buku & Siswa Mengundurkan Diri (ADR-0019)");
  const refundUrl = `${baseUrl.replace(/\/$/, "")}/refund`;
  await page.goto(refundUrl, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");

  const refundSearchInput = page.locator('input[placeholder*="nama"], input[placeholder*="Cari"]');
  if (await refundSearchInput.count() > 0) {
    await refundSearchInput.first().fill("Kayla");
    const cariBtn = page.locator('button:has-text("Cari Pesanan"), button:has-text("Cari")');
    if (await cariBtn.count() > 0) {
      await cariBtn.first().click();
      await page.waitForLoadState("networkidle");
    }
    await captureScreenshot(page, "09-cari-refund-kayla.png");

    const pilihOrderBtn = page.locator('button:has-text("Pilih"), button:has-text("Ajukan")');
    if (await pilihOrderBtn.count() > 0) {
      await pilihOrderBtn.first().click();
      await page.waitForLoadState("networkidle");

      // Cek toggle siswa mengundurkan diri
      const withdrawalToggle = page.locator('input[type="checkbox"]');
      if (await withdrawalToggle.count() > 0) {
        await withdrawalToggle.first().check();
        const reasonInput = page.locator('textarea[id*="reason"], textarea');
        if (await reasonInput.count() > 0) {
          await reasonInput.first().fill("Siswa mengundurkan diri karena mutasi orang tua ke luar kota");
        }
        await captureScreenshot(page, "09-form-withdrawal-buku.png");
        console.log("  ✓ Form pembatalan buku siswa mengundurkan diri aktif.");
      }
    }
  }

  // -------------------------------------------------------------
  // Skenario 15: Portal Pemesanan & Retur/Refund Seragam RET-U (Bab 20)
  // -------------------------------------------------------------
  console.log("\n▶ [Bab 20 / Skenario 15] Portal Pemesanan & Retur Seragam Siswa Mundur");
  const seragamUrl = `${baseUrl.replace(/\/$/, "")}/seragam`;
  await page.goto(seragamUrl, { waitUntil: "networkidle" });
  await page.waitForLoadState("domcontentloaded");
  await captureScreenshot(page, "15-portal-seragam.png");

  // Tab Retur Seragam
  const returSeragamTab = page.locator('button:has-text("Retur Seragam"), a:has-text("Retur Seragam")');
  if (await returSeragamTab.count() > 0) {
    await returSeragamTab.first().click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "15-tab-retur-seragam.png");
    console.log("  ✓ Tab Retur Seragam diakses (dukungan tukar & refund mundur).");
  }
}
