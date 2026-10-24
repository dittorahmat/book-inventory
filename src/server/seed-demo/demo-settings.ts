import { and, eq, isNull, or } from "drizzle-orm";
import { WPR_BOOK_ID, WPR_TITLE } from "../../lib/wpr";
import { books, systemSettings } from "../../db/schema";
import { BOOK_LIST } from "./catalog";
import type { SeedContext } from "./context";

/**
 * Pengaturan demo sengaja tanpa password SMTP/token WA: uji kirim harus
 * berstatus "simulasi", bukan gagal 502 karena kredensial palsu.
 */
const DEMO_SETTINGS = [
  { key: "smtp_port", value: "587", description: "SMTP Port" },
  { key: "smtp_secure", value: "false", description: "Use SSL/TLS" },
  { key: "smtp_username", value: "logistics@alwildan.sch.id", description: "SMTP Username" },
  { key: "smtp_from_name", value: "Al Wildan School Logistics", description: "Sender Name" },
  { key: "smtp_from_email", value: "logistics@alwildan.sch.id", description: "Sender Email" },
  { key: "email_provider", value: "auto", description: "Email Provider" },
  { key: "wa_meta_phone_id", value: "1234567890", description: "WhatsApp Meta Phone Number ID" },
  { key: "wa_meta_token", value: "", description: "WhatsApp Meta Access Token" },
  { key: "wa_meta_enabled", value: "false", description: "WhatsApp Meta Enabled" },
  { key: "uniform_order_prefix", value: "USO", description: "Prefix nomor order seragam" },
  { key: "uniform_claim_prefix", value: "CLM", description: "Prefix nomor klaim cabang" },
  { key: "satuan_open_from:2026/2027", value: "2026-07-01", description: "Tanggal buka pesanan satuan 2026/2027" },
  { key: "uniform_satuan_enabled", value: "true", description: "Pesanan seragam satuan dibuka" },
];

export async function seedDemoSettings({ db: targetDb, now }: SeedContext) {
  for (const setting of DEMO_SETTINGS) {
    await targetDb
      .insert(systemSettings)
      .values({ ...setting, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: setting.value, description: setting.description, updatedAt: now },
      });
  }

  // Judul publik hanya diisi saat kosong: edit manual katalog tidak ditimpa.
  for (const book of BOOK_LIST) {
    await targetDb
      .update(books)
      .set({ publicTitle: book.title, updatedAt: now })
      .where(and(eq(books.id, book.id), or(isNull(books.publicTitle), eq(books.publicTitle, ""))));
  }
  await targetDb
    .update(books)
    .set({ publicTitle: WPR_TITLE, updatedAt: now })
    .where(and(eq(books.id, WPR_BOOK_ID), or(isNull(books.publicTitle), eq(books.publicTitle, ""))));
}
