import { Hono } from "hono";
import { app } from "./index";

import { getDatabase } from "../db";
import { setStorageService, CloudflareR2StorageService } from "../services/storage";

type Bindings = {
  DB: any;
  BUCKET: any;
  ASSETS: { fetch: typeof fetch };
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
