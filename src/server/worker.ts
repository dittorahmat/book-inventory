import { Hono } from "hono";
import { app } from "./index";

type Bindings = {
  DB: any;
  BUCKET: any;
  ASSETS: { fetch: typeof fetch };
};

const worker = new Hono<{ Bindings: Bindings }>();

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
