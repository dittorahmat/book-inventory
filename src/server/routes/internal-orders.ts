import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { internalPurchaseOrders } from "../../db/schema";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import { createInternalPo, fulfillInternalPo, listInternalPOs, listInternalShipments } from "../services/internal-po";

export const internalOrdersRouter = new Hono();

const createInternalPoSchema = z.object({
  schoolId: z.string().min(1, "Cabang pemesan wajib dipilih"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      packageId: z.string().min(1, "Paket buku wajib dipilih"),
      quantityOrdered: z.number().int().min(1, "Kuantitas minimal 1"),
    })
  ).min(1, "Minimal 1 paket yang dipesan"),
});

const createShipmentSchema = z.object({
  deliveryNoteNumber: z.string().min(1, "Nomor Surat Jalan pengiriman internal wajib diisi"),
  shippedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      packageId: z.string().optional(),
      packageItemId: z.string().optional(),
      bookId: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
      isOutstandingFollowup: z.boolean().default(false),
    })
  ).min(1, "Minimal 1 item yang dikirim"),
});

// 1. GET list internal purchase orders
internalOrdersRouter.get("/", async (c) => {
  try {
    const { scope: scopeList } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const scope = new Set(scopeList);
    const schoolId = scope.size === 1 ? [...scope][0] : c.req.query("schoolId");

    const data = await listInternalPOs(db, schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. POST create internal PO from branch to HQ
internalOrdersRouter.post("/", zValidator("json", createInternalPoSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);

    const result = await createInternalPo(db, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    const { id, poNumber } = result.data;

    return c.json(
      {
        success: true,
        message: `PO Internal ${poNumber} berhasil diterbitkan ke Gudang Pusat`,
        data: { id, poNumber },
      },
      201
    );
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 3. POST create Shipment (Surat Jalan Pengiriman Internal)
internalOrdersRouter.post("/:id/shipments", zValidator("json", createShipmentSchema), async (c) => {
  try {
    await resolveLogisticsActor(c); // Hanya HQ / Gudang yang boleh menerbitkan pengiriman
    const poId = c.req.param("id");
    const body = c.req.valid("json");

    const result = await fulfillInternalPo(db, poId, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: `Surat Jalan Pengiriman ${body.deliveryNoteNumber} berhasil dibuat`,
      data: { shipmentId: result.data.shipmentId, status: result.data.status },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4. GET shipment history for internal PO
internalOrdersRouter.get("/:id/shipments", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const poId = c.req.param("id");

    const [po] = await db
      .select()
      .from(internalPurchaseOrders)
      .where(eq(internalPurchaseOrders.id, poId));
    if (!po) {
      return c.json({ success: false, message: "PO Internal tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, po.schoolId, locations);

    const result = await listInternalShipments(db, poId);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
