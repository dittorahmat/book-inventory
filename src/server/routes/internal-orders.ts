import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  internalPurchaseOrders,
  internalPurchaseOrderItems,
  internalShipments,
  internalShipmentItems,
  bookPackages,
  books,
  schools,
} from "../../db/schema";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import { createInternalPo, fulfillInternalPo } from "../services/internal-po";

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

    const orders = await db
      .select({
        id: internalPurchaseOrders.id,
        poNumber: internalPurchaseOrders.poNumber,
        schoolId: internalPurchaseOrders.schoolId,
        schoolName: schools.name,
        status: internalPurchaseOrders.status,
        notes: internalPurchaseOrders.notes,
        createdAt: internalPurchaseOrders.createdAt,
        updatedAt: internalPurchaseOrders.updatedAt,
      })
      .from(internalPurchaseOrders)
      .innerJoin(schools, eq(internalPurchaseOrders.schoolId, schools.id))
      .where(schoolId ? eq(internalPurchaseOrders.schoolId, schoolId) : undefined)
      .orderBy(desc(internalPurchaseOrders.createdAt));

    const orderIds = orders.map((o: { id: string }) => o.id);
    const allItems = orderIds.length > 0
      ? await db
          .select({
            id: internalPurchaseOrderItems.id,
            internalPoId: internalPurchaseOrderItems.internalPoId,
            packageId: internalPurchaseOrderItems.packageId,
            packageName: bookPackages.name,
            packageCode: bookPackages.code,
            quantityOrdered: internalPurchaseOrderItems.quantityOrdered,
            quantityFulfilled: internalPurchaseOrderItems.quantityFulfilled,
          })
          .from(internalPurchaseOrderItems)
          .innerJoin(bookPackages, eq(internalPurchaseOrderItems.packageId, bookPackages.id))
          .where(inArray(internalPurchaseOrderItems.internalPoId, orderIds))
      : [];

    type PoItem = (typeof allItems)[number];
    const itemsByPo = new Map<string, PoItem[]>();
    for (const it of allItems) {
      const list = itemsByPo.get(it.internalPoId) || [];
      list.push(it);
      itemsByPo.set(it.internalPoId, list);
    }

    const data = orders.map((o: (typeof orders)[number]) => ({
      ...o,
      items: itemsByPo.get(o.id) || [],
    }));

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

    const shipments = await db
      .select()
      .from(internalShipments)
      .where(eq(internalShipments.internalPoId, poId))
      .orderBy(desc(internalShipments.createdAt));

    const shipmentIds = shipments.map((s: { id: string }) => s.id);
    const shipmentItemsList = shipmentIds.length > 0
      ? await db
          .select({
            id: internalShipmentItems.id,
            shipmentId: internalShipmentItems.shipmentId,
            packageId: internalShipmentItems.packageId,
            packageName: bookPackages.name,
            bookId: internalShipmentItems.bookId,
            bookTitle: books.title,
            quantity: internalShipmentItems.quantity,
            isOutstandingFollowup: internalShipmentItems.isOutstandingFollowup,
          })
          .from(internalShipmentItems)
          .leftJoin(bookPackages, eq(internalShipmentItems.packageId, bookPackages.id))
          .leftJoin(books, eq(internalShipmentItems.bookId, books.id))
          .where(inArray(internalShipmentItems.shipmentId, shipmentIds))
      : [];

    type ShipmentItem = (typeof shipmentItemsList)[number];
    const itemsByShipment = new Map<string, ShipmentItem[]>();
    for (const it of shipmentItemsList) {
      const list = itemsByShipment.get(it.shipmentId) || [];
      list.push(it);
      itemsByShipment.set(it.shipmentId, list);
    }

    const data = shipments.map((s: (typeof shipments)[number]) => ({
      ...s,
      items: itemsByShipment.get(s.id) || [],
    }));

    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
