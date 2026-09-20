import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { schoolsRouter } from "./routes/schools";
import { booksRouter } from "./routes/books";
import { bookItemsRouter } from "./routes/bookItems";
import { shipmentsRouter } from "./routes/shipments";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/schools", schoolsRouter);
app.route("/api/books", booksRouter);
app.route("/api/book-items", bookItemsRouter);
app.route("/api/shipments", shipmentsRouter);

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
