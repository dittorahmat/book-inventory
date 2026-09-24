import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getSmtpConfig, saveSmtpConfig, sendEmailNotification } from "../services/email";

export const settingsRouter = new Hono();

const updateSmtpSchema = z.object({
  host: z.string().min(1, "Host wajib diisi"),
  port: z.number().int().min(1).default(587),
  secure: z.boolean().default(false),
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().optional(),
  fromName: z.string().min(1, "From Name wajib diisi"),
  fromEmail: z.string().email("Format email pengirim tidak valid"),
});

const testEmailSchema = z.object({
  recipientEmail: z.string().email("Format email tujuan tidak valid"),
});

// GET current SMTP config (excluding sensitive password)
settingsRouter.get("/smtp", async (c) => {
  const config = await getSmtpConfig();
  return c.json({
    success: true,
    data: {
      ...config,
      password: config.password ? "********" : "",
      isConfigured: Boolean(config.password),
    },
  });
});

// POST save SMTP config
settingsRouter.post("/smtp", zValidator("json", updateSmtpSchema), async (c) => {
  const body = c.req.valid("json");
  await saveSmtpConfig(body);
  return c.json({ success: true, message: "Pengaturan SMTP berhasil disimpan" });
});

// POST send test email
settingsRouter.post("/smtp/test", zValidator("json", testEmailSchema), async (c) => {
  const { recipientEmail } = c.req.valid("json");
  const result = await sendEmailNotification({
    to: recipientEmail,
    subject: "Uji Coba Notifikasi Email Al Wildan School Logistics",
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #050505;">
        <h2>Uji Coba Konfigurasi SMTP Berhasil</h2>
        <p>Sistem inventaris dan pemesanan buku sekolah Al Wildan telah terhubung dengan server email.</p>
        <p style="color: #65676B; font-size: 12px;">Waktu pengiriman: ${new Date().toLocaleString("id-ID")}</p>
      </div>
    `,
  });

  return c.json({
    success: true,
    message: result.simulated
      ? `Email uji coba berhasil disimulasikan (belum ada password SMTP)`
      : `Email uji coba berhasil dikirim ke ${recipientEmail}`,
    data: result,
  });
});
