import { Hono } from "hono";
import { app } from "./index";
import type { D1Database, ExecutionContext, R2Bucket, ScheduledController } from "@cloudflare/workers-types";

import { getDatabase } from "../db";
import { setStorageService, CloudflareR2StorageService } from "../services/storage";
import { alertJunkSchools } from "./services/d1-junk-alert";
import { alertDrift } from "./services/d1-drift-alert";
import type { EmailRuntimeEnv } from "./services/email/types";

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: { fetch: typeof fetch };
  // Email transport secrets (dibaca layer email via c.env, lihat services/email/*)
  EMAIL_PROVIDER?: string;
  BREVO_API_KEY?: string;
  BREVO_API_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM_NAME?: string;
  SMTP_FROM_EMAIL?: string;
};

const worker = new Hono<{ Bindings: Bindings }>();

// Ensure Cloudflare D1 & R2 are bound to the database & storage services
worker.use("*", async (c, next) => {
  if (c.env?.DB) {
    await getDatabase(c.env);
  }
  if (c.env?.BUCKET) {
    setStorageService(new CloudflareR2StorageService(c.env.BUCKET));
  }
  await next();
});

// Mount the agnostic API routes
worker.route("/", app);

// Serve static assets or fallback (SPA routing support)
worker.all("*", async (c) => {
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404 && !c.req.path.startsWith("/api/")) {
      // SPA Fallback: route browser yang bukan /api/* dikembalikan ke index.html
      const url = new URL(c.req.url);
      url.pathname = "/index.html";
      return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    }
    return res;
  }
  return c.text("Book Inventory API running on Cloudflare Workers", 200);
});

export default {
  fetch: worker.fetch,
  /**
   * Cron harian (17:00 UTC = 00:00 WIB, lihat `[triggers]` wrangler.toml):
   * dua alarm production tanpa kredensial — sampah data-uji (§6) dan drift
   * skema (§1) — keduanya query lewat binding D1. Dijalankan sekuensial
   * (query tulis `system_settings` di dalamnya, §10: dilarang `Promise.all`).
   * `console.log` di sini disengaja: cron tidak punya respons HTTP, jadi Workers
   * Logs adalah satu-satunya kanal untuk melihat hasil/kegagalan non-email.
   */
  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    _ctx: ExecutionContext
  ): Promise<void> {
    if (!env.DB) return;
    const database = await getDatabase(env);
    const deps = { env: env as unknown as EmailRuntimeEnv };
    const junk = await alertJunkSchools(database, deps);
    const drift = await alertDrift(database, deps);
    console.log(`[cron d1-alarm] junk=${JSON.stringify(junk)} drift=${JSON.stringify(drift)}`);
  },
};
