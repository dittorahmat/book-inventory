import { Hono } from "hono";
import { runDemoSeed } from "../seed";
import { accessErrorResponse, requireCentralAdmin, resolveRequestActor } from "../services/access-scope";

export const demoRouter = new Hono();

demoRouter.post("/seed", async (c) => {
  try {
    requireCentralAdmin(await resolveRequestActor(c));
    const result = await runDemoSeed();
    return c.json({
      success: true,
      message: "Data demo operasional Al Wildan berhasil dirombak total dan diperbarui secara komprehensif!",
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
