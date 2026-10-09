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
  loadLocationIds,
  requireLogisticsRole,
  resolveLocationScope,
  resolveRequestActor,
} from "../services/access-scope";

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
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const scope = new Set(resolveLocationScope(actor, c.req.query("schoolId"), locations));
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
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const poNumber = `IPO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    await db.insert(internalPurchaseOrders).values({
      id,
      poNumber,
      schoolId: body.schoolId,
      status: "submitted",
      notes: body.notes || null,
      createdByUserId: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of body.items) {
      await db.insert(internalPurchaseOrderItems).values({
        id: crypto.randomUUID(),
        internalPoId: id,
        packageId: item.packageId,
        quantityOrdered: item.quantityOrdered,
        quantityFulfilled: 0,
        createdAt: now,
      });
    }

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
    const actor = await resolveRequestActor(c);
    requireLogisticsRole(actor); // Hanya HQ / Gudang yang boleh menerbitkan pengiriman
    const poId = c.req.param("id");
    const body = c.req.valid("json");

    const [po] = await db
      .select()
      .from(internalPurchaseOrders)
      .where(eq(internalPurchaseOrders.id, poId));
    if (!po) {
      return c.json({ success: false, message: "PO Internal tidak ditemukan" }, 404);
    }

    const now = new Date().toISOString();
    const shipmentId = crypto.randomUUID();

    await db.insert(internalShipments).values({
      id: shipmentId,
      internalPoId: poId,
      deliveryNoteNumber: body.deliveryNoteNumber.trim(),
      shippedDate: body.shippedDate || now.split("T")[0],
      status: "in_transit",
      notes: body.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    // Catat items pada Surat Jalan & update progress pemenuhan PO
    const currentPoItems = await db
      .select()
      .from(internalPurchaseOrderItems)
      .where(eq(internalPurchaseOrderItems.internalPoId, poId));
    type InternalPoItemRow = (typeof currentPoItems)[number];
    const poItemMap = new Map<string, InternalPoItemRow>(
      currentPoItems.map((it: InternalPoItemRow) => [it.packageId, it])
    );

    for (const item of body.items) {
      await db.insert(internalShipmentItems).values({
        id: crypto.randomUUID(),
        shipmentId,
        packageId: item.packageId || null,
        packageItemId: item.packageItemId || null,
        bookId: item.bookId || null,
        quantity: item.quantity,
        isOutstandingFollowup: item.isOutstandingFollowup,
        createdAt: now,
      });

      // Update quantityFulfilled jika item ini merupakan pemenuhan paket utama
      if (item.packageId) {
        const poItem = poItemMap.get(item.packageId);
        if (poItem) {
          const newFulfilled = Math.min(poItem.quantityOrdered, (poItem.quantityFulfilled ?? 0) + item.quantity);
          await db
            .update(internalPurchaseOrderItems)
            .set({ quantityFulfilled: newFulfilled })
            .where(eq(internalPurchaseOrderItems.id, poItem.id));
          poItem.quantityFulfilled = newFulfilled;
        }
      }
    }

    // Hitung status pemenuhan PO
    const updatedPoItems = await db
      .select()
      .from(internalPurchaseOrderItems)
      .where(eq(internalPurchaseOrderItems.internalPoId, poId));
    const allCompleted = updatedPoItems.every(
      (it: InternalPoItemRow) => (it.quantityFulfilled ?? 0) >= it.quantityOrdered
    );
    const nextStatus = allCompleted ? "completed" : "partial_fulfilled";

    await db
      .update(internalPurchaseOrders)
      .set({ status: nextStatus, updatedAt: now })
      .where(eq(internalPurchaseOrders.id, poId));

    return c.json({
      success: true,
      message: `Surat Jalan Pengiriman ${body.deliveryNoteNumber} berhasil dibuat`,
      data: { shipmentId, status: nextStatus },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4. GET shipment history for internal PO
internalOrdersRouter.get("/:id/shipments", async (c) => {
  try {
    await resolveRequestActor(c);
    const poId = c.req.param("id");

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
