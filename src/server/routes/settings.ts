import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { getUniformNumbering, isUniformSatuanEnabled, saveUniformNumbering, setUniformSatuanEnabled } from "../services/uniform";
import type { EmailRuntimeEnv } from "../services/email/types";
import {
  getMetaView,
  getSmtpView,
  saveMeta,
  saveSmtp,
  testMeta,
  testSmtp,
} from "../services/settings-notifications";
import { currentAcademicYear } from "../../lib/wib-time";
import {
  getSatuanStatus,
  setSatuanOpenFrom,
  setSatuanOverride,
  type SatuanOverride,
} from "../services/order-intake";
import { accessErrorResponse } from "../services/access-scope";
import {
  getWarehouseReturnAddress,
  saveWarehouseReturnAddress,
  warehouseReturnAddressSchema,
} from "../services/return-address";
import { assertSettingsAdmin } from "../services/settings-access";

export const settingsRouter = new Hono();

const updateSmtpSchema = z.object({
  host: z.string().min(1, "Host wajib diisi"),
  port: z.number().int().min(1).default(587),
  secure: z.boolean().default(false),
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().optional(),
  fromName: z.string().min(1, "From Name wajib diisi"),
  fromEmail: z.string().email("Format email pengirim tidak valid"),
  emailProvider: z.enum(["auto", "brevo", "smtp"]).default("auto"),
  brevoApiKey: z.string().optional(),
  brevoApiUrl: z.string().optional(),
});

const testEmailSchema = z.object({
  recipientEmail: z.string().email("Format email tujuan tidak valid"),
});

const academicYearSchema = z.string().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran harus 2026/2027");

const openFromSchema = z.object({
  academicYear: academicYearSchema,
  openFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
});

const overrideSchema = z.object({
  academicYear: academicYearSchema,
  override: z.enum(["open", "closed", "auto"]),
});

// GET status cut-off order satuan (hanya peran logistik)
settingsRouter.get("/satuan-cutoff", async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    const academicYear = c.req.query("academicYear")?.trim() || currentAcademicYear();
    const data = await getSatuanStatus(db, academicYear);
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST simpan tanggal efektif buka order satuan
settingsRouter.post("/satuan-cutoff/open-from", zValidator("json", openFromSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    const { academicYear, openFrom } = c.req.valid("json");
    const data = await setSatuanOpenFrom(db, academicYear, openFrom);
    return c.json({
      success: true,
      message: `Order satuan tahun ajaran ${academicYear} akan terbuka mulai ${openFrom} (WIB).`,
      data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST simpan override manual (open / closed / auto)
settingsRouter.post("/satuan-cutoff/override", zValidator("json", overrideSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    const { academicYear, override } = c.req.valid("json");
    const next: SatuanOverride | null = override === "auto" ? null : override;
    const data = await setSatuanOverride(db, academicYear, next);
    return c.json({
      success: true,
      message:
        override === "auto"
          ? `Override tahun ajaran ${academicYear} dihapus, kembali mengikuti tanggal efektif.`
          : `Order satuan tahun ajaran ${academicYear} dipaksa ${override === "open" ? "buka" : "tutup"}.`,
      data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// GET status on/off satuan seragam (peran logistik)
settingsRouter.get("/uniform-satuan", async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    return c.json({ success: true, data: { open: await isUniformSatuanEnabled(db) } });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST on/off satuan seragam (peran logistik)
settingsRouter.post("/uniform-satuan", zValidator("json", z.object({ enabled: z.boolean() })), async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    const { open } = await setUniformSatuanEnabled(db, c.req.valid("json").enabled);
    return c.json({ success: true, message: `Pembelian satuan seragam ${open ? "dibuka" : "ditutup"}.`, data: { open } });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// GET current email config (secrets masked, never exposed; hanya central admin)
settingsRouter.get("/smtp", async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    const env = c.env as unknown as EmailRuntimeEnv | undefined;
    return c.json({ success: true, data: await getSmtpView(db, env) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST save email config (hanya central admin)
settingsRouter.post("/smtp", zValidator("json", updateSmtpSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    const body = c.req.valid("json");
    await saveSmtp(db, body);
    return c.json({ success: true, message: "Pengaturan email berhasil disimpan" });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST send test email (honest: reports the real provider + outcome; hanya central admin)
settingsRouter.post("/smtp/test", zValidator("json", testEmailSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    const { recipientEmail } = c.req.valid("json");
    const env = c.env as unknown as EmailRuntimeEnv | undefined;
    const result = await testSmtp(db, recipientEmail, env);

    if (!result.success) {
      return c.json(
        {
          success: false,
          message: `Email uji coba GAGAL via ${result.provider}: ${result.error}`,
          data: result,
        },
        502
      );
    }

    return c.json({
      success: true,
      message: result.simulated
        ? `Email uji coba hanya disimulasikan (tidak benar-benar terkirim). ${result.error || ""}`.trim()
        : `Email uji coba benar-benar terkirim via ${result.provider} ke ${recipientEmail}`,
      data: result,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST send test WhatsApp message
const testWhatsAppSchema = z.object({
  phone: z.string().min(6, "Nomor tujuan WhatsApp minimal 6 karakter"),
  message: z.string().default("Ini adalah pesan uji coba dari sistem Inventaris Buku Al Wildan."),
});

// GET konfigurasi WA Meta Official (token disamarkan; hanya central admin)
settingsRouter.get("/whatsapp-meta", async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    return c.json({ success: true, data: await getMetaView(db) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

const updateMetaWhatsAppSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID wajib diisi"),
  accessToken: z.string().optional().default(""),
  isEnabled: z.boolean().default(true),
});

// POST simpan konfigurasi WA Meta Official (hanya central admin)
settingsRouter.post("/whatsapp-meta", zValidator("json", updateMetaWhatsAppSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    const body = c.req.valid("json");
    await saveMeta(db, body);
    return c.json({ success: true, message: "Pengaturan WhatsApp Meta berhasil disimpan" });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST uji kirim via Meta Official
settingsRouter.post("/whatsapp-meta/test", zValidator("json", testWhatsAppSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    const { phone, message } = c.req.valid("json");
    const result = await testMeta(db, phone, message);
    if (!result.success) {
      return c.json({ success: false, message: result.error || "Gagal mengirim WhatsApp uji coba" }, 502);
    }
    return c.json({
      success: true,
      message: result.simulated
        ? "Pesan uji coba disimulasikan (Meta belum diisi atau dinonaktifkan)."
        : `Pesan uji coba WhatsApp berhasil dikirim ke ${phone}`,
      data: result,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

const prefixSchema = z.string().trim().regex(/^[A-Z0-9-]{1,10}$/, "Prefix 1–10 karakter (A–Z, 0–9, -)");

const uniformNumberingSchema = z.object({
  orderPrefix: prefixSchema,
  claimPrefix: prefixSchema,
});

// GET prefix penomoran seragam (hanya central admin)
settingsRouter.get("/uniform-numbering", async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    return c.json({ success: true, data: await getUniformNumbering(db) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST simpan prefix penomoran seragam (hanya central admin)
settingsRouter.post("/uniform-numbering", zValidator("json", uniformNumberingSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "notif");
    return c.json({ success: true, data: await saveUniformNumbering(db, c.req.valid("json")) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// GET alamat retur Gudang Pusat (khusus admin logistik / central)
settingsRouter.get("/return-address", async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    return c.json({ success: true, data: await getWarehouseReturnAddress(db) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST simpan alamat retur Gudang Pusat (khusus admin logistik / central)
settingsRouter.post("/return-address", zValidator("json", warehouseReturnAddressSchema), async (c) => {
  try {
    await assertSettingsAdmin(c, "cutoff");
    return c.json({ success: true, data: await saveWarehouseReturnAddress(db, c.req.valid("json")) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});


