import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { publicOrderReturnsRouter } from "./public-order-returns";

describe("public-order-returns router", () => {
  const app = new Hono();
  app.route("/api/public/orders", publicOrderReturnsRouter);

  it("validates cancel-withdrawal input schema", async () => {
    const res = await app.request("/api/public/orders/cancel-withdrawal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "invalid",
        studentId: "invalid",
        reason: "sh",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("validates submit-return input schema", async () => {
    const res = await app.request("/api/public/orders/submit-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "invalid",
        studentId: "invalid",
        defectiveBookId: "invalid",
        reason: "sh",
      }),
    });
    expect(res.status).toBe(400);
  });
});
