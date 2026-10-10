import { describe, expect, it, afterEach } from "bun:test";
import { inArray } from "drizzle-orm";
import { settingsRouter } from "./settings";
import { auth } from "../auth";
import { db } from "../../db";
import { systemSettings } from "../../db/schema";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "BREVO_API_KEY",
  "BREVO_API_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_NAME",
  "SMTP_FROM_EMAIL",
];

const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

async function cleanupEmailKeys() {
  await db
    .delete(systemSettings)
    .where(inArray(systemSettings.key, ["email_provider", "brevo_api_key", "brevo_api_url"]));
}

async function cleanupWhatsAppKeys() {
  await db
    .delete(systemSettings)
    .where(
      inArray(systemSettings.key, ["wa_gateway_url", "wa_api_key", "wa_sender_number", "wa_enabled"])
    );
}

type NotifRole = "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin" | null;
const realGetSession = auth.api.getSession;
function actAs(role: NotifRole) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId: null } } as any) : null;
}

afterEach(async () => {
  (auth.api as any).getSession = realGetSession;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = realFetch;
});

const realFetch = globalThis.fetch;

describe("Settings SMTP jujur (masking + provider)", () => {
  it("GET /smtp menutupi rahasia dan melaporkan isConfigured", async () => {
    actAs("central_admin");
    clearEnv();
    await cleanupEmailKeys();

    const res = await settingsRouter.request("/smtp", { method: "GET" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // Rahasia tidak pernah bocor mentah
    expect(["", "********"]).toContain(json.data.password);
    expect(["", "********"]).toContain(json.data.brevoApiKey);
    expect(typeof json.data.isConfigured).toBe("boolean");
    expect(["auto", "brevo", "smtp"]).toContain(json.data.provider);
  });

  it("POST /smtp menyimpan provider + brevo key, GET menandai brevoConfigured", async () => {
    actAs("central_admin");
    clearEnv();
    const saveRes = await settingsRouter.request("/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "admin@alwildan.sch.id",
        fromName: "Al Wildan School Logistics",
        fromEmail: "logistics@alwildan.sch.id",
        emailProvider: "brevo",
        brevoApiKey: "xkeysib-test-simpan",
      }),
    });
    expect(saveRes.status).toBe(200);

    const getRes = await settingsRouter.request("/smtp", { method: "GET" });
    const json = await getRes.json();
    expect(json.data.provider).toBe("brevo");
    expect(json.data.brevoApiKey).toBe("********");
    expect(json.data.brevoConfigured).toBe(true);
    expect(json.data.isConfigured).toBe(true);

    await cleanupEmailKeys();
  });

  it("POST /smtp/test jujur: sukses via brevo bila provider merespons 201", async () => {
    actAs("central_admin");
    clearEnv();
    await db.insert(systemSettings).values([
      { key: "email_provider", value: "brevo", description: "t", updatedAt: new Date().toISOString() },
      { key: "brevo_api_key", value: "xkeysib-test-kirim", description: "t", updatedAt: new Date().toISOString() },
    ]).onConflictDoNothing();

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ messageId: "<brevo-test-1>" }), { status: 201 })) as any;

    const res = await settingsRouter.request("/smtp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail: "uji@example.com" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.provider).toBe("brevo");
    expect(json.data.simulated).toBe(false);
    expect(json.message).toMatch(/benar-benar terkirim via brevo/);

    await cleanupEmailKeys();
  });

  it("POST /smtp/test jujur: 502 + GAGAL bila Brevo menolak", async () => {
    actAs("central_admin");
    clearEnv();
    await db.insert(systemSettings).values([
      { key: "email_provider", value: "brevo", description: "t", updatedAt: new Date().toISOString() },
      { key: "brevo_api_key", value: "xkeysib-salah", description: "t", updatedAt: new Date().toISOString() },
    ]).onConflictDoNothing();

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "unauthorized", code: 401 }), { status: 401 })) as any;

    const res = await settingsRouter.request("/smtp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail: "uji@example.com" }),
    });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.data.provider).toBe("brevo");
    expect(json.message).toMatch(/GAGAL/);

    await cleanupEmailKeys();
  });

  it("POST /smtp/test jujur: simulasi bila tanpa kredensial", async () => {
    actAs("central_admin");
    clearEnv();
    await cleanupEmailKeys();

    const res = await settingsRouter.request("/smtp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail: "uji@example.com" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.simulated).toBe(true);
    expect(json.message).toMatch(/disimulasikan/);
  });

  it("GET and POST /whatsapp saves configuration and masks apiKey", async () => {
    actAs("central_admin");
    const postRes = await settingsRouter.request("/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gatewayUrl: "https://wa.test.internal/send",
        apiKey: "secret-token-123",
        senderNumber: "628123456789",
        isEnabled: true,
      }),
    });
    expect(postRes.status).toBe(200);

    const getRes = await settingsRouter.request("/whatsapp", { method: "GET" });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data.gatewayUrl).toBe("https://wa.test.internal/send");
    expect(getJson.data.apiKey).toBe("********");
    expect(getJson.data.isConfigured).toBe(true);

    await cleanupWhatsAppKeys();
  });
});

const NOTIF_ENDPOINTS: Array<{ method: string; path: string; body?: unknown }> = [
  { method: "GET", path: "/smtp" },
  {
    method: "POST",
    path: "/smtp",
    body: {
      host: "smtp.test.internal",
      username: "notif-test",
      fromName: "Tes Notifikasi",
      fromEmail: "notif@test.internal",
    },
  },
  { method: "POST", path: "/smtp/test", body: { recipientEmail: "uji@example.com" } },
  { method: "GET", path: "/whatsapp" },
  { method: "POST", path: "/whatsapp", body: { gatewayUrl: "https://wa.test.internal/send" } },
  { method: "POST", path: "/whatsapp/test", body: { phone: "08123456789" } },
];

function notifRequest(ep: (typeof NOTIF_ENDPOINTS)[number]) {
  return settingsRouter.request(ep.path, {
    method: ep.method,
    ...(ep.body
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(ep.body) }
      : {}),
  });
}

describe("Kredensial notifikasi terkunci untuk central saja (#42)", () => {
  it("tanpa sesi → 401 di semua endpoint kredensial dan uji-kirim", async () => {
    actAs(null);
    for (const ep of NOTIF_ENDPOINTS) {
      const res = await notifRequest(ep);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    }
  });

  it("peran non-pusat (gudang, sekolah, cabang) → 403 di semua endpoint kredensial dan uji-kirim", async () => {
    const roles = ["warehouse_admin", "school_admin", "branch_admin"] as const;
    for (const role of roles) {
      actAs(role);
      for (const ep of NOTIF_ENDPOINTS) {
        const res = await notifRequest(ep);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
      }
    }
  });

  it("central tetap bisa membaca config (secret ter-mask) dan menyimpan", async () => {
    actAs("central_admin");
    clearEnv();
    await cleanupEmailKeys();
    await cleanupWhatsAppKeys();

    const smtpGet = await settingsRouter.request("/smtp", { method: "GET" });
    expect(smtpGet.status).toBe(200);
    const smtpJson = await smtpGet.json();
    expect(smtpJson.success).toBe(true);
    expect(["", "********"]).toContain(smtpJson.data.password);
    expect(["", "********"]).toContain(smtpJson.data.brevoApiKey);

    const smtpSave = await settingsRouter.request("/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "smtp.test.internal",
        username: "notif-test",
        fromName: "Tes Notifikasi",
        fromEmail: "notif@test.internal",
      }),
    });
    expect(smtpSave.status).toBe(200);

    const waSave = await settingsRouter.request("/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gatewayUrl: "https://wa.test.internal/send", isEnabled: false }),
    });
    expect(waSave.status).toBe(200);

    const waGet = await settingsRouter.request("/whatsapp", { method: "GET" });
    expect(waGet.status).toBe(200);
    const waJson = await waGet.json();
    expect(waJson.success).toBe(true);
    expect(["", "********"]).toContain(waJson.data.apiKey);

    await cleanupEmailKeys();
    await cleanupWhatsAppKeys();
  });

  it("central tetap bisa uji-kirim (simulasi hermetik tanpa kredensial)", async () => {
    actAs("central_admin");
    clearEnv();
    await cleanupEmailKeys();
    await cleanupWhatsAppKeys();

    const emailRes = await settingsRouter.request("/smtp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail: "uji@example.com" }),
    });
    expect(emailRes.status).toBe(200);
    const emailJson = await emailRes.json();
    expect(emailJson.success).toBe(true);
    expect(emailJson.data.simulated).toBe(true);

    const waRes = await settingsRouter.request("/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "08123456789" }),
    });
    expect(waRes.status).toBe(200);
    const waJson = await waRes.json();
    expect(waJson.success).toBe(true);
    expect(waJson.data.simulated).toBe(true);
  });
});
