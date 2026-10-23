import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { internalPurchaseOrders, internalShipments } from "../../db/schema";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import {
  createInternalPo,
  fulfillInternalPo,
  listInternalPOs,
  listInternalShipments,
  listOutstandingPOs,
  createManualShipment,
  receiveInternalShipment,
} from "../services/internal-po";
import { idSchema } from "../lib/validators";
import { isLogisticsRole } from "../../lib/staff-roles";

export const internalOrdersRouter = new Hono();

const resolveSchoolScope = (role: string | undefined, requested: string | undefined, scopeList: string[]): string | undefined =>
  isLogisticsRole(role as Parameters<typeof isLogisticsRole>[0]) ? requested : scopeList.length === 1 ? scopeList[0] : requested;


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
    const { actor, scope: scopeList } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = resolveSchoolScope(actor.role, c.req.query("schoolId"), scopeList);

    const data = await listInternalPOs(db, schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. GET list outstanding POs for shipments suggestion
internalOrdersRouter.get("/outstanding", async (c) => {
  try {
    const { actor, scope: scopeList } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = resolveSchoolScope(actor.role, c.req.query("schoolId"), scopeList);

    const data = await listOutstandingPOs(db, schoolId);
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

const createManualShipmentSchema = z.object({
  destinationSchoolId: idSchema,
  deliveryNoteNumber: z.string().min(1, "Nomor Surat Jalan pengiriman internal wajib diisi"),
  shippedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      packageId: idSchema.optional(),
      packageItemId: idSchema.optional(),
      bookId: idSchema.optional(),
      quantity: z.number().int().min(1).default(1),
      isOutstandingFollowup: z.boolean().default(false),
    })
  ).min(1, "Minimal 1 item yang dikirim"),
});

// 4. POST create Manual Shipment without PO
internalOrdersRouter.post("/shipments/manual", zValidator("json", createManualShipmentSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");

    const result = await createManualShipment(db, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json(
      {
        success: true,
        message: `Surat Jalan Pengiriman Manual ${body.deliveryNoteNumber} berhasil dibuat`,
        data: { shipmentId: result.data.shipmentId },
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

const receiveShipmentSchema = z.object({
  receivedDate: z.string().optional(),
  receivedByUserId: idSchema.optional(),
  transferShipmentId: idSchema.optional(),
  deliveryProofUrl: z.string().min(1, "Dokumen Surat Jalan bertanda tangan dan cap basah wajib diunggah"),
  items: z.array(
    z.object({
      shipmentItemId: idSchema,
      condition: z.enum(["good", "damaged", "missing"]),
      notes: z.string().optional(),
    })
  ).min(1, "Minimal 1 baris kondisi penerimaan wajib diisi"),
});

// 4. POST receive Shipment (Penerimaan cabang + penyesuaian selisih)
internalOrdersRouter.post("/shipments/:shipmentId/receive", zValidator("json", receiveShipmentSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const shipmentId = c.req.param("shipmentId");
    const body = c.req.valid("json");

    const [shipment] = await db
      .select()
      .from(internalShipments)
      .where(eq(internalShipments.id, shipmentId));
    if (!shipment) {
      return c.json({ success: false, message: "Surat Jalan Internal tidak ditemukan" }, 404);
    }
    const targetSchoolId = shipment.destinationSchoolId;
    if (targetSchoolId) {
      assertLocationAllowed(actor, targetSchoolId, locations);
    }

    const result = await receiveInternalShipment(db, shipmentId, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({
      success: true,
      message:
        result.data.status === "discrepancy"
          ? `Surat Jalan ${shipment.deliveryNoteNumber} diterima dengan selisih — perlu penyesuaian`
          : `Surat Jalan ${shipment.deliveryNoteNumber} berhasil diterima cabang`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5. GET shipment history for internal PO
internalOrdersRouter.get("/:id/shipments", async (c) => {  try {
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
