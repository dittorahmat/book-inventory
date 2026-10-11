import { describe, expect, it, afterEach } from "bun:test";
import { db } from "../../db";
import {
  getSmtpConfig,
  sendEmailNotification,
  selectProviderName,
} from "./email/factory";
import type { ResolvedEmailConfig } from "./email/types";

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

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const baseConfig: ResolvedEmailConfig = {
  providerSetting: "auto",
  brevoApiKey: "",
  brevoApiUrl: "https://api.brevo.com/v3/smtp/email",
  smtpHost: "",
  smtpUser: "",
  smtpPassword: "",
  smtpPort: 587,
  smtpSecure: false,
  fromName: "Test",
  fromEmail: "test@example.com",
};

describe("Email provider selection (murni, tanpa kirim)", () => {
  it("auto di Bun tanpa kredensial -> simulated", () => {
    const sel = selectProviderName(baseConfig, true);
    expect(sel.provider).toBe("simulated");
    expect(sel.simulatedReason).toBeTruthy();
  });

  it("auto di Bun dengan SMTP lengkap -> smtp", () => {
    const sel = selectProviderName(
      { ...baseConfig, smtpHost: "smtp.example.com", smtpUser: "u", smtpPassword: "p" },
      true
    );
    expect(sel.provider).toBe("smtp");
  });

  it("eksplisit brevo tanpa key -> simulated dengan alasan", () => {
    const sel = selectProviderName({ ...baseConfig, providerSetting: "brevo" }, true);
    expect(sel.provider).toBe("simulated");
    expect(sel.simulatedReason).toMatch(/Brevo/i);
  });

  it("eksplisit smtp di Workers -> simulated (tanpa TCP)", () => {
    const sel = selectProviderName(
      {
        ...baseConfig,
        providerSetting: "smtp",
        smtpHost: "smtp.example.com",
        smtpUser: "u",
        smtpPassword: "p",
      },
      false
    );
    expect(sel.provider).toBe("simulated");
  });

  it("auto di Workers dengan Brevo key -> brevo", () => {
    const sel = selectProviderName({ ...baseConfig, brevoApiKey: "xkeysib-test" }, false);
    expect(sel.provider).toBe("brevo");
  });
});

describe("getSmtpConfig membaca env tiruan (prioritas env)", () => {
  it("membaca BREVO_API_KEY dari env eksplisit", async () => {
    clearEnv();
    const config = await getSmtpConfig(db, { BREVO_API_KEY: "xkeysib-dari-env" });
    expect(config.brevoApiKey).toBe("xkeysib-dari-env");
  });
});

describe("sendEmailNotification via Brevo (fetch di-stub)", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("mengirim via Brevo dan mengembalikan messageId provider", async () => {
    clearEnv();
    let seenUrl = "";
    let seenApiKey = "";
    globalThis.fetch = (async (url: any, init: any) => {
      seenUrl = String(url);
      seenApiKey = init?.headers?.["api-key"] || "";
      return new Response(JSON.stringify({ messageId: "<brevo-test-id>" }), { status: 201 });
    }) as any;

    const result = await sendEmailNotification(
      db,
      { to: "supplier@example.com", subject: "PO Test", html: "<p>PO</p>" },
      { BREVO_API_KEY: "xkeysib-test-key" }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe("brevo");
    expect(result.simulated).toBe(false);
    expect(result.messageId).toBe("<brevo-test-id>");
    expect(seenUrl).toContain("brevo.com");
    expect(seenApiKey).toBe("xkeysib-test-key");
  });

  it("Brevo 401 -> gagal eksplisit, bukan klaim terkirim", async () => {
    clearEnv();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "Key not valid", code: "unauthorized" }), {
        status: 401,
      })) as any;

    const result = await sendEmailNotification(
      db,
      { to: "supplier@example.com", subject: "PO Test", html: "<p>PO</p>" },
      { BREVO_API_KEY: "xkeysib-salah" }
    );

    expect(result.success).toBe(false);
    expect(result.provider).toBe("brevo");
    expect(result.simulated).toBe(false);
    expect(result.error).toMatch(/Brevo menolak/i);
  });

  it("tanpa kredensial -> simulasi jujur, tidak klaim terkirim", async () => {
    clearEnv();
    const result = await sendEmailNotification(
      db,
      { to: "supplier@example.com", subject: "PO Test", html: "<p>PO</p>" },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe("simulated");
    expect(result.simulated).toBe(true);
  });
});
