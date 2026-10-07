import { Hono } from "hono";
import { app } from "./index";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

import { getDatabase } from "../db";
import { setStorageService, CloudflareR2StorageService } from "../services/storage";

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

// Serve static assets or fallback
worker.all("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Book Inventory API running on Cloudflare Workers", 200);
});

export default worker;
