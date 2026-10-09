import { describe, expect, it, afterEach } from "bun:test";
import { inArray } from "drizzle-orm";
import { settingsRouter } from "./settings";
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

afterEach(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = realFetch;
});

const realFetch = globalThis.fetch;

describe("Settings SMTP jujur (masking + provider)", () => {
  it("GET /smtp menutupi rahasia dan melaporkan isConfigured", async () => {
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
  });
});
