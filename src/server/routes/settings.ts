import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getSmtpConfig, saveSmtpConfig, sendEmailNotification } from "../services/email/factory";
import type { EmailRuntimeEnv } from "../services/email/types";
import { currentAcademicYear } from "../../lib/wib-time";
import {
  getSatuanStatus,
  setSatuanOpenFrom,
  setSatuanOverride,
  type SatuanOverride,
} from "../services/satuan-cutoff";
import { accessErrorResponse, requireLogisticsRole, resolveRequestActor } from "../services/access-scope";

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

/** Otorisasi pengaturan cut-off: hanya central admin / admin gudang. */
async function assertCutoffAdmin(c: Context) {
  const actor = await resolveRequestActor(c);
  requireLogisticsRole(actor);
}

// GET status cut-off order satuan (hanya peran logistik)
settingsRouter.get("/satuan-cutoff", async (c) => {
  try {
    await assertCutoffAdmin(c);
    const academicYear = c.req.query("academicYear")?.trim() || currentAcademicYear();
    const data = await getSatuanStatus(academicYear);
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST simpan tanggal efektif buka order satuan
settingsRouter.post("/satuan-cutoff/open-from", zValidator("json", openFromSchema), async (c) => {
  try {
    await assertCutoffAdmin(c);
    const { academicYear, openFrom } = c.req.valid("json");
    const data = await setSatuanOpenFrom(academicYear, openFrom);
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
    await assertCutoffAdmin(c);
    const { academicYear, override } = c.req.valid("json");
    const next: SatuanOverride | null = override === "auto" ? null : override;
    const data = await setSatuanOverride(academicYear, next);
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

// GET current email config (secrets masked, never exposed)
settingsRouter.get("/smtp", async (c) => {
  const env = c.env as unknown as EmailRuntimeEnv | undefined;
  const config = await getSmtpConfig(env);
  const smtpConfigured = Boolean(config.password);
  const brevoConfigured = Boolean(config.brevoApiKey);
  return c.json({
    success: true,
    data: {
      ...config,
      password: smtpConfigured ? "********" : "",
      brevoApiKey: brevoConfigured ? "********" : "",
      isConfigured: smtpConfigured || brevoConfigured,
      smtpConfigured,
      brevoConfigured,
    },
  });
});

// POST save email config
settingsRouter.post("/smtp", zValidator("json", updateSmtpSchema), async (c) => {
  const body = c.req.valid("json");
  await saveSmtpConfig({ ...body, provider: body.emailProvider });
  return c.json({ success: true, message: "Pengaturan email berhasil disimpan" });
});

// POST send test email (honest: reports the real provider + outcome)
settingsRouter.post("/smtp/test", zValidator("json", testEmailSchema), async (c) => {
  const { recipientEmail } = c.req.valid("json");
  const env = c.env as unknown as EmailRuntimeEnv | undefined;
  const result = await sendEmailNotification(
    {
      to: recipientEmail,
      subject: "Uji Coba Notifikasi Email Al Wildan School Logistics",
      html: `
      <div style="font-family: sans-serif; padding: 20px; color: #050505;">
        <h2>Uji Coba Konfigurasi Email Berhasil</h2>
        <p>Sistem inventaris dan pemesanan buku sekolah Al Wildan telah terhubung dengan layanan email.</p>
        <p style="color: #65676B; font-size: 12px;">Waktu pengiriman: ${new Date().toLocaleString("id-ID")}</p>
      </div>
    `,
    },
    env
  );

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
});
