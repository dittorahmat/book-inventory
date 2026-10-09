import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { schoolsRouter } from "./routes/schools";
import { booksRouter } from "./routes/books";
import { bookItemsRouter } from "./routes/bookItems";
import { shipmentsRouter } from "./routes/shipments";
import { usersRouter } from "./routes/users";
import { demoRouter } from "./routes/demo";
import { packagesRouter } from "./routes/packages";
import { publicOrdersRouter } from "./routes/public-orders";
import { studentsRouter } from "./routes/students";
import { paymentsRouter } from "./routes/payments";
import { studentOrdersRouter } from "./routes/student-orders";
import { dashboardRouter } from "./routes/dashboard";
import { procurementRouter } from "./routes/procurement";
import { poWorkflowRouter } from "./routes/po-workflow";
import { stockSummaryRouter } from "./routes/stock-summary";
import { salesReportRouter } from "./routes/sales-report";
import { settingsRouter } from "./routes/settings";
import { internalOrdersRouter } from "./routes/internal-orders";
import { directSalesRouter } from "./routes/direct-sales";
import { vendorReturnsRouter } from "./routes/vendor-returns";
import { auth } from "./auth";

import { defaultStorage } from "../services/storage";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// Global JSON error envelope: portal publik dan semua klien selalu
// menerima JSON (tidak pernah plain-teks "Internal Server Error").
app.onError((err, c) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(`[API] Unhandled error ${c.req.method} ${c.req.path} (ref ${requestId}):`, err);
  return c.json(
    {
      success: false,
      message: "Terjadi kendala pada server. Silakan coba lagi beberapa saat.",
      ref: requestId,
      path: c.req.path,
    },
    500
  );
});

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

app.route("/api/public/orders", publicOrdersRouter);
app.route("/api/students", studentsRouter);
app.route("/api/student-orders", studentOrdersRouter);
app.route("/api/dashboard", dashboardRouter);
  app.route("/api/procurement", procurementRouter);
  app.route("/api/procurement", poWorkflowRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/settings", settingsRouter);
app.route("/api/schools", schoolsRouter);
app.route("/api/books", booksRouter);
  app.route("/api/book-items", bookItemsRouter);
  app.route("/api/stock-summary", stockSummaryRouter);
  app.route("/api/sales-report", salesReportRouter);
app.route("/api/packages", packagesRouter);
app.route("/api/internal-orders", internalOrdersRouter);
app.route("/api/direct-sales", directSalesRouter);
app.route("/api/vendor-returns", vendorReturnsRouter);
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
