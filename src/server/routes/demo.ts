import { Hono } from "hono";
import { runIdempotentSeed } from "../seed";

export const demoRouter = new Hono();

demoRouter.post("/seed", async (c) => {
  const result = await runIdempotentSeed();
  return c.json({
    success: true,
    message: "Data demo operasional Al Wildan berhasil dirombak total dan diperbarui secara komprehensif!",
    data: result.data,
  });
});
