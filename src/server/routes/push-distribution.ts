import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { idSchema } from "../lib/validators";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
} from "../services/access-scope";
import {
  calculateSchoolPushQuota,
  createPushDistributionShipment,
} from "../services/push-distribution";

export const pushDistributionRouter = new Hono();

const pushShipmentSchema = z.object({
  schoolId: idSchema,
  deliveryNoteNumber: z.string().optional(),
  shippedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      packageId: idSchema,
      quantity: z.number().int().min(1, "Kuantitas minimal 1"),
    })
  ).min(1, "Minimal 1 paket yang dikirim"),
});

// 1. GET kalkulasi kuota Cap Max siswa per cabang
pushDistributionRouter.get("/quota/:schoolId", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const schoolId = c.req.param("schoolId");
    const academicYear = c.req.query("academicYear");
    assertLocationAllowed(actor, schoolId, locations);

    const quota = await calculateSchoolPushQuota(db, schoolId, academicYear);
    return c.json({ success: true, data: quota });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. POST terbitkan pengiriman Push Distribution langsung ke cabang
pushDistributionRouter.post("/", zValidator("json", pushShipmentSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);

    const result = await createPushDistributionShipment(db, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: "Pengiriman Push Distribution berhasil diterbitkan",
      data: result.data,
    }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
