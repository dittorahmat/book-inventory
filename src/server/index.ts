import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { schoolsRouter } from "./routes/schools";
import { booksRouter } from "./routes/books";
import { bookItemsRouter } from "./routes/bookItems";
import { shipmentsRouter } from "./routes/shipments";
import { usersRouter } from "./routes/users";
import { demoRouter } from "./routes/demo";
import { auth } from "./auth";

import { defaultStorage } from "../services/storage";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// Mount Better-Auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Serve media assets (from R2 or memory storage)
app.get("/api/media/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/media\//, "");
  if (!key) {
    return c.text("Key is required", 400);
  }

  const file = await defaultStorage.getFile(key);
  if (!file) {
    return c.text("Media not found", 404);
  }

  c.header("Content-Type", file.contentType || "image/jpeg");
  c.header("Cache-Control", "public, max-age=31536000, immutable");
  return c.body(file.data as any);
});

app.route("/api/schools", schoolsRouter);
app.route("/api/books", booksRouter);
app.route("/api/book-items", bookItemsRouter);
app.route("/api/shipments", shipmentsRouter);
app.route("/api/users", usersRouter);
app.route("/api/demo", demoRouter);

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
